import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSurveyEmails } from "@/lib/email/resend";
import { generateSurveyLink } from "@/lib/utils/token";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "hr_management"].includes(profile.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Get survey details
  const admin = createAdminClient();
  const { data: survey, error: surveyError } = await admin
    .from("surveys")
    .select("title_fr, status, societe_id")
    .eq("id", surveyId)
    .single();

  if (surveyError || !survey) {
    return NextResponse.json(
      { error: "Sondage introuvable" },
      { status: 404 }
    );
  }

  if (survey.status !== "published") {
    return NextResponse.json(
      { error: "Le sondage doit être publié pour envoyer des invitations" },
      { status: 400 }
    );
  }

  // Get tokens with emails that haven't been invited yet (filtered by survey's company)
  let tokensQuery = admin
    .from("anonymous_tokens")
    .select("id, token, email, employee_name")
    .not("email", "is", null)
    .is("invitation_sent_at", null);

  if (survey.societe_id) {
    tokensQuery = tokensQuery.eq("societe_id", survey.societe_id);
  }

  const { data: uninvitedTokens, error: tokensError } = await tokensQuery;

  if (tokensError) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération des tokens" },
      { status: 500 }
    );
  }

  if (!uninvitedTokens || uninvitedTokens.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      failed: 0,
      total: 0,
      message: "Toutes les invitations ont déjà été envoyées",
    });
  }

  // Prepare recipients
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const recipients = uninvitedTokens.map((t) => ({
    email: t.email!,
    employeeName: t.employee_name || "Collaborateur",
    surveyLink: generateSurveyLink(baseUrl, surveyId, t.token),
  }));

  // Send emails
  const result = await sendSurveyEmails(
    recipients,
    survey.title_fr,
    "invitation"
  );

  // Update invitation_sent_at for successfully sent tokens
  if (result.sent > 0) {
    const failedEmails = new Set(result.errors.map((e) => e.email));
    const successIds = uninvitedTokens
      .filter((t) => !failedEmails.has(t.email!))
      .map((t) => t.id);

    if (successIds.length > 0) {
      await admin
        .from("anonymous_tokens")
        .update({ invitation_sent_at: new Date().toISOString() })
        .in("id", successIds);
    }
  }

  return NextResponse.json({
    success: true,
    sent: result.sent,
    failed: result.failed,
    total: recipients.length,
    errors: result.errors,
  });
}
