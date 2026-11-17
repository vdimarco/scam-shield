export type Risk = "safe" | "unsure" | "suspicious";

export interface Verdict {
  risk: Risk;
  tactics: string[];
  reason: string;
  /** Where the check actually ran, as reported by the SDK. Null means unknown. */
  ranOnDevice: boolean | null;
}

export const TACTICS = [
  "urgency or threats",
  "fake login page",
  "asks for gift cards or crypto",
  "prize or refund bait",
  "pretends to be a known company",
  "pretends to be family or a friend",
  "tech support scare",
  "asks to install software",
];

export function parseVerdict(text: string, source: string | undefined): Verdict {
  const ranOnDevice = source === "on_device" ? true : source === "in_cloud" ? false : null;
  const uncertain: Verdict = {
    risk: "unsure",
    tactics: [],
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
  const { risk, tactics, reason } = raw as Record<string, unknown>;
  if (
    (risk !== "safe" && risk !== "unsure" && risk !== "suspicious") ||
    !Array.isArray(tactics) ||
    !tactics.every((t) => typeof t === "string" && TACTICS.includes(t)) ||
    typeof reason !== "string" ||
    !reason.trim()
  ) return uncertain;

  return { risk, tactics, reason: reason.trim(), ranOnDevice };
}

export function accountForPartialPage(verdict: Verdict, truncated: boolean): Verdict {
  return truncated && verdict.risk === "safe"
    ? { ...verdict, risk: "unsure", reason: "Only part of this page was checked. Verify the site independently before acting." }
    : verdict;
}
