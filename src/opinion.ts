export function opinionSourceNote(searchFellBack: boolean, hasSources: boolean): string {
  if (searchFellBack) {
    return "Web verification is unavailable right now. This explanation uses only the page shown. Verify through the official app or a phone number you already trust.";
  }
  return hasSources
    ? "Open these sources to check the evidence yourself."
    : "This check returned no web sources to review. Verify through the official app or a phone number you already trust.";
}
