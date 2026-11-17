import type { PageSnapshot } from "./page";

export type Risk = "safe" | "unsure" | "suspicious";

export interface Verdict {
  risk: Risk;
  reason: string;
  /** Where the check actually ran, as reported by the SDK. Null means unknown. */
  ranOnDevice: boolean | null;
}

export function parseVerdict(text: string, source: string | undefined): Verdict {
  const ranOnDevice = source === "on_device" ? true : source === "in_cloud" ? false : null;
  const uncertain: Verdict = {
    risk: "unsure",
    reason: "I couldn't confirm this check. Please verify the site independently before acting.",
    ranOnDevice,
  };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return uncertain;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return uncertain;
  const { risk, reason } = raw as Record<string, unknown>;
  if (
    (risk !== "safe" && risk !== "unsure" && risk !== "suspicious") ||
    typeof reason !== "string" ||
    !reason.trim()
  ) return uncertain;

  return { risk, reason: reason.trim(), ranOnDevice };
}

export function accountForPageEvidence(verdict: Verdict, page: PageSnapshot): Verdict {
  if (verdict.risk !== "safe") return verdict;
  if (page.truncated) return { ...verdict, risk: "unsure", reason: "Only part of this page was checked. Verify the site independently before acting." };
  if (page.asksForPassword || page.asksForCard) {
    return { ...verdict, risk: "unsure", reason: "This page asks for sensitive details. Confirm its address before sharing them." };
  }
  if (page.formsPostElsewhere || page.mismatchedLinks) {
    return { ...verdict, risk: "unsure", reason: "A form or link points to another site. Check its destination before acting." };
  }
  return verdict;
}
