# Scam Shield judge video

The [70-second judge cut](scam-shield-judge-final.mp4) has the existing ElevenLabs Faye
[voice](voiceover-script.md), [English subtitles](scam-shield-judge-final.srt), restrained
motion highlights, and an actual recording of Chrome's native Scam Shield side panel. The
fictional parcel page and older-adult portrait are labelled illustrations. The film shows two
separate observed on-device results: the hosted checker screenshot and the extension video.

**Public status:** [the current YouTube upload](https://youtu.be/49NiHLv1WZg) is the earlier
silent, captioned 88-second cut. It has not been replaced with this new on-device film. The
updated film and WebVTT are live on the [Vercel demo](https://scam-shield-landing-phi.vercel.app/#demo-video).

## Footage and claims

| Time | What the video shows | Evidence and limit |
| --- | --- | --- |
| 0:00–0:29 | An illustrative grandmother scenario, a fictional parcel page, and the hosted checker result. | The [hosted screenshot](hosted-on-device-proof.png) reports on-device inference in Chrome. It is a separate observed run from the extension capture. |
| 0:29–0:37 | Private screening is enabled in the installed extension, which flags the fictional parcel page and offers a concrete next step. | The right side is the first 5.6 seconds of an [11-second recording](extension-check-on-device.webm) of Chrome's **native side panel** while the local parcel fixture tab remained active. The page on the left is a still from that fixture. This is an edited split view, not an uninterrupted browser-window screen recording. The [observation](extension-check-on-device.json) records Chrome 157, model availability `available`, site `127.0.0.1`, risk `suspicious`, and the exact source text “This page's content was checked on this computer.” The final cut ends before the requested cloud second-opinion action. |
| 0:37–1:10 | A small synthetic scorecard, concrete protective steps, and the public checker and source links. | The 4/4 and 0/4 figures are from one eight-page synthetic run. The separate [archived-page evaluation](../evaluation/real-world/README.md) gives a broader bounded test; neither is a live-browsing accuracy estimate. |

The native side-panel footage is a sequence of actual CDP screenshots, encoded at 24 fps;
the page still was composited beside it for legibility. There are no simulated product states.
No real scam site was opened. The parcel page cannot take payment and uses fictional `.invalid`
destinations. The portrait is illustrative and is not a photograph of the creator's grandmother.

The raw 11-second capture includes a later requested cloud second-opinion attempt that failed
in this isolated Chrome profile: its App Check debug-token exchange returned HTTP 403 and the
cloud request returned an invalid-token error. That action and result are outside the final
video segment. The final film makes no cloud second-opinion result claim.

`scam-shield-narrated.mp4`, `scam-shield-judge-candidate.mp4`, and
`scam-shield-real-check.mp4` are earlier historical cuts, not the current judge video.

To reproduce the recording, build the private judge extension and use a model-ready Chrome
test profile on the real Wayland GPU desktop. Launch Chrome normally with remote debugging
and `--enable-unsafe-extension-debugging`, then set `CAPTURE_CDP_URL` and
`CAPTURE_EXTENSION_ID` for `node demo/capture_extension.mjs`. The script gates output on the
installed extension's source label, inspected fixture hostname, and suspicious result. The
film is rebuilt with `python3 demo/build_narrated_video.py`. No App Check debug token,
personal message, or real browsing URL is included in the film or this folder.
