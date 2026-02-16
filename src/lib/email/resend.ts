import { Resend } from "resend";
import {
  generateEmailHtml,
  generateEmailText,
  generateEmailSubject,
  type EmailTemplateType,
} from "./templates";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "PulseSurvey <onboarding@resend.dev>";
const BATCH_SIZE = 100;

export interface EmailRecipient {
  email: string;
  employeeName: string;
  surveyLink: string;
}

export interface SendEmailsResult {
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export async function sendSurveyEmails(
  recipients: EmailRecipient[],
  surveyTitle: string,
  type: EmailTemplateType = "invitation"
): Promise<SendEmailsResult> {
  const result: SendEmailsResult = {
    sent: 0,
    failed: 0,
    errors: [],
  };

  if (recipients.length === 0) {
    return result;
  }

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    try {
      const emails = batch.map((recipient) => ({
        from: FROM_EMAIL,
        to: recipient.email,
        subject: generateEmailSubject(type, surveyTitle),
        html: generateEmailHtml(type, {
          employeeName: recipient.employeeName,
          surveyTitle,
          surveyLink: recipient.surveyLink,
        }),
        text: generateEmailText(type, {
          employeeName: recipient.employeeName,
          surveyTitle,
          surveyLink: recipient.surveyLink,
        }),
      }));

      const response = await resend.batch.send(emails);

      if (response.error) {
        result.failed += batch.length;
        for (const recipient of batch) {
          result.errors.push({
            email: recipient.email,
            error: response.error.message || "Erreur batch inconnue",
          });
        }
      } else {
        // Batch succeeded — count all as sent
        result.sent += batch.length;
      }
    } catch (error) {
      result.failed += batch.length;
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      for (const recipient of batch) {
        result.errors.push({
          email: recipient.email,
          error: errorMessage,
        });
      }
    }
  }

  return result;
}
