export type TeamsMessageType = "invitation" | "reminder";

interface TeamsMessageData {
  employeeName: string;
  surveyTitle: string;
  surveyLink: string;
}

export function generateTeamsMessage(
  type: TeamsMessageType,
  data: TeamsMessageData
): string {
  const { employeeName, surveyTitle, surveyLink } = data;

  if (type === "invitation") {
    return (
      `Bonjour ${employeeName},\n\n` +
      `Nous vous invitons à participer à notre enquête : **${surveyTitle}**.\n\n` +
      `Votre avis est important et nous aidera à améliorer notre environnement de travail.\n\n` +
      `👉 [Répondre au sondage](${surveyLink})\n\n` +
      `---\n` +
      `🔒 **Votre anonymat est garanti** — Ce lien est personnel et anonyme. ` +
      `Vos réponses individuelles ne seront jamais associées à votre identité.`
    );
  }

  return (
    `Bonjour ${employeeName},\n\n` +
    `Nous n'avons pas encore reçu votre réponse à l'enquête : **${surveyTitle}**.\n\n` +
    `Si vous ne l'avez pas encore fait, nous vous encourageons à prendre quelques minutes pour y répondre.\n\n` +
    `👉 [Répondre au sondage](${surveyLink})\n\n` +
    `---\n` +
    `🔒 **Votre anonymat est garanti** — Ce lien est personnel et anonyme. ` +
    `Vos réponses individuelles ne seront jamais associées à votre identité.`
  );
}
