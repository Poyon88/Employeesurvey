export type EmailTemplateType = "invitation" | "reminder";

interface EmailTemplateData {
  employeeName: string;
  surveyTitle: string;
  surveyLink: string;
}

export function generateEmailSubject(
  type: EmailTemplateType,
  surveyTitle: string
): string {
  switch (type) {
    case "invitation":
      return `Invitation : ${surveyTitle}`;
    case "reminder":
      return `Rappel : ${surveyTitle}`;
  }
}

export function generateEmailHtml(
  type: EmailTemplateType,
  data: EmailTemplateData
): string {
  const { employeeName, surveyTitle, surveyLink } = data;

  const invitationBody = `
    <p>Nous vous invitons à participer à notre enquête : <strong>${surveyTitle}</strong>.</p>
    <p>Votre avis est important et nous aidera à améliorer notre environnement de travail.</p>
  `;

  const reminderBody = `
    <p>Nous n'avons pas encore reçu votre réponse à l'enquête : <strong>${surveyTitle}</strong>.</p>
    <p>Si vous ne l'avez pas encore fait, nous vous encourageons à prendre quelques minutes pour y répondre.</p>
  `;

  const body = type === "invitation" ? invitationBody : reminderBody;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="color: #2563eb; margin: 0; font-size: 24px;">PulseSurvey</h1>
  </div>

  <div style="margin-bottom: 24px;">
    <p>Bonjour ${employeeName},</p>
    ${body}
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${surveyLink}"
       style="background-color: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
      Répondre au sondage
    </a>
  </div>

  <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 14px; color: #1e40af;">
      <strong>Votre anonymat est garanti</strong><br>
      Ce lien est personnel et anonyme. Vos réponses individuelles ne seront jamais associées à votre identité.
    </p>
  </div>

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
    <p>Si vous avez des questions, contactez votre service RH.</p>
    <p style="margin-top: 12px;">Ce lien est unique et ne doit pas être partagé.</p>
  </div>
</body>
</html>`;
}

export function generateEmailText(
  type: EmailTemplateType,
  data: EmailTemplateData
): string {
  const { employeeName, surveyTitle, surveyLink } = data;

  const invitationBody =
    `Nous vous invitons à participer à notre enquête : ${surveyTitle}.\n\n` +
    `Votre avis est important et nous aidera à améliorer notre environnement de travail.\n\n`;

  const reminderBody =
    `Nous n'avons pas encore reçu votre réponse à l'enquête : ${surveyTitle}.\n\n` +
    `Si vous ne l'avez pas encore fait, nous vous encourageons à prendre quelques minutes pour y répondre.\n\n`;

  const body = type === "invitation" ? invitationBody : reminderBody;

  return (
    `Bonjour ${employeeName},\n\n` +
    body +
    `Répondre au sondage :\n${surveyLink}\n\n` +
    `VOTRE ANONYMAT EST GARANTI\n` +
    `Ce lien est personnel et anonyme. Vos réponses individuelles ne seront jamais associées à votre identité.\n\n` +
    `---\n` +
    `Si vous avez des questions, contactez votre service RH.\n` +
    `Ce lien est unique et ne doit pas être partagé.`
  );
}
