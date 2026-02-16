import { randomUUID } from "crypto";

/**
 * Generates a unique anonymous token for an employee.
 * The token is a random UUID with no link to the employee's identity.
 */
export function generateAnonymousToken(): string {
  return randomUUID();
}

/**
 * Generates a survey link with an embedded anonymous token.
 */
export function generateSurveyLink(
  baseUrl: string,
  surveyId: string,
  token: string
): string {
  return `${baseUrl}/s/${surveyId}?t=${token}`;
}
