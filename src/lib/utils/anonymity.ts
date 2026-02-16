/**
 * Anonymity threshold - minimum number of respondents required
 * to display results for a group.
 */
export const ANONYMITY_THRESHOLD = 10;

/**
 * Checks if a group has enough respondents to display results.
 * Returns true if results can be shown, false if they should be masked.
 */
export function canShowResults(respondentCount: number): boolean {
  return respondentCount >= ANONYMITY_THRESHOLD;
}

/**
 * Returns a message explaining why results are hidden.
 */
export function getAnonymityMessage(lang: "fr" | "en" = "fr"): string {
  if (lang === "en") {
    return `Results not available to preserve anonymity (fewer than ${ANONYMITY_THRESHOLD} respondents)`;
  }
  return `Résultats non disponibles pour préserver l'anonymat (moins de ${ANONYMITY_THRESHOLD} répondants)`;
}
