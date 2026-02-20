import { generateTeamsMessage, type TeamsMessageType } from "./templates";

const BATCH_SIZE = 20; // Graph API is more rate-limited than email

export interface TeamsRecipient {
  email: string;
  employeeName: string;
  surveyLink: string;
}

export interface SendTeamsResult {
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export function isTeamsConfigured(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET
  );
}

async function getAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID!;
  const clientId = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Échec d'authentification Azure: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendChatMessage(
  accessToken: string,
  userEmail: string,
  message: string
): Promise<void> {
  // Step 1: Create a 1:1 chat with the user
  const chatResponse = await fetch("https://graph.microsoft.com/v1.0/chats", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatType: "oneOnOne",
      members: [
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}`,
        },
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users/${process.env.AZURE_BOT_USER_ID || process.env.AZURE_CLIENT_ID}`,
        },
      ],
    }),
  });

  if (!chatResponse.ok) {
    const error = await chatResponse.text();
    throw new Error(`Impossible de créer le chat: ${error}`);
  }

  const chat = await chatResponse.json();

  // Step 2: Send message in the chat
  const messageResponse = await fetch(
    `https://graph.microsoft.com/v1.0/chats/${chat.id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: {
          contentType: "html",
          content: message.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<b>$1</b>"),
        },
      }),
    }
  );

  if (!messageResponse.ok) {
    const error = await messageResponse.text();
    throw new Error(`Impossible d'envoyer le message: ${error}`);
  }
}

export async function sendTeamsMessages(
  recipients: TeamsRecipient[],
  surveyTitle: string,
  type: TeamsMessageType = "invitation"
): Promise<SendTeamsResult> {
  const result: SendTeamsResult = {
    sent: 0,
    failed: 0,
    errors: [],
  };

  if (recipients.length === 0) {
    return result;
  }

  if (!isTeamsConfigured()) {
    throw new Error("Microsoft Teams n'est pas configuré. Veuillez définir AZURE_TENANT_ID, AZURE_CLIENT_ID et AZURE_CLIENT_SECRET.");
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur d'authentification";
    throw new Error(`Impossible de se connecter à Microsoft Graph: ${msg}`);
  }

  // Process in batches
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    // Send messages sequentially within a batch to respect rate limits
    for (const recipient of batch) {
      try {
        const message = generateTeamsMessage(type, {
          employeeName: recipient.employeeName,
          surveyTitle,
          surveyLink: recipient.surveyLink,
        });

        await sendChatMessage(accessToken, recipient.email, message);
        result.sent++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          email: recipient.email,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return result;
}
