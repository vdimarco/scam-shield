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
    reason: "I couldn't confirm this check. Please verify the message independently before acting.",
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
