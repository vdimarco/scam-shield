# Chrome 157 local AI crash investigation

On November 17, 2026, Chrome's on-device model service crashed twice in
`liboptimization_guide_internal.so + 0x3f5257` in the same test profile.
The core contained an `INTERNAL: Parser Error` reporting that an unexpected
`<html>` token did not satisfy the JSON grammar while generating a verdict.
Disassembly shows an indirect-call target check branching to `ud1` in the
error-reporting path, with a source reference to
`components/optimization_guide/internal/chrome_ml_api_litert_lm_utils.cc`.

Removing the local `responseConstraint` and requesting JSON in the prompt was
tested as a possible workaround. Existing validation does return `unsure` for
malformed output, but this version was rejected after a larger local check.

An initial smoke test used an isolated copy of the original profile in Chrome 157.0.8103.78
with the installed local model. Twelve sequential calls through `screenPage`
completed with `ranOnDevice === true`; an instrumented Prompt API observed zero
`responseConstraint` calls. Inputs alternated ordinary library text and synthetic
HTML containing a scam request. Two results were `safe`, ten were `unsure`.
The copied profile was deleted after testing. That smoke test was not a verdict
accuracy benchmark or proof that native crashes were eliminated.

A later [same-case diagnostic](../evaluation/real-world/README.md#difficult-legitimate-pages-and-timeout-probe-november-17-2026) used the on-device model on 20 difficult legitimate archived pages. The unconstrained version produced 14 generic JSON-parse fallbacks in a repeat pass. The one investment scam that had previously timed out completed eight times under each setting: the constrained version called it suspicious eight times, while the unconstrained version returned eight parse-failure `unsure` verdicts. Neither version timed out in those replays, so this does not identify the original stall stage or establish that removing the constraint prevents crashes.

Keep the local JSON response constraint for useful verdicts. The 60-second UI
deadline stops the panel from waiting indefinitely, but the browser model call
may continue after that deadline. The native crash remains unresolved; diagnose
future stalls with the evaluator's session-creation and prompt-stage markers.
