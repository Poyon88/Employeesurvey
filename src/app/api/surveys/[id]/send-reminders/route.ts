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
      { error: "Le sondage doit être publié pour envoyer des rappels" },
      { status: 400 }
    );
  }

  // Check if survey_tokens exist for this survey
  const { count: stCount } = await admin
    .from("survey_tokens")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", surveyId);

  let tokens;

  if (stCount && stCount > 0) {
    // New behavior: use survey_tokens (invited = invitation_sent_at not null)
    const { data: surveyTokensData, error: stError } = await admin
      .from("survey_tokens")
      .select("token_id, invitation_sent_at, anonymous_tokens!inner(id, token, email, employee_name)")
      .eq("survey_id", surveyId)
      .not("invitation_sent_at", "is", null);

    if (stError) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des tokens" },
        { status: 500 }
      );
    }

    tokens = (surveyTokensData || [])
      .filter((st: any) => st.anonymous_tokens?.email)
      .map((st: any) => ({
        id: st.anonymous_tokens.id,
        token: st.anonymous_tokens.token,
        email: st.anonymous_tokens.email,
        employee_name: st.anonymous_tokens.employee_name,
        survey_token_id: st.token_id,
      }));
  } else {
    // Legacy behavior: filter by societe_id
    let tokensQuery = admin
      .from("anonymous_tokens")
      .select("id, token, email, employee_name")
      .eq("active", true)
      .not("email", "is", null)
      .not("invitation_sent_at", "is", null);

    if (survey.societe_id) {
      tokensQuery = tokensQuery.eq("societe_id", survey.societe_id);
    }

    const { data, error: tokensError } = await tokensQuery;
    if (tokensError) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des tokens" },
        { status: 500 }
      );
    }
    tokens = data || [];
  }

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      failed: 0,
      total: 0,
      message: "Aucune invitation envoyée. Envoyez d'abord les invitations.",
    });
  }

  // Get responses to filter out those who already responded
  const { data: responses } = await admin
    .from("responses")
    .select("token_id")
    .eq("survey_id", surveyId);

  const respondedTokenIds = new Set(
    (responses || []).map((r) => r.token_id)
  );

  const nonResponders = tokens.filter(
    (t) => !respondedTokenIds.has(t.id)
  );

  if (nonResponders.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      failed: 0,
      total: 0,
      message: "Tous les destinataires ont déjà répondu",
    });
  }

  // Prepare recipients
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const recipients = nonResponders.map((t) => ({
    email: t.email!,
    employeeName: t.employee_name || "Collaborateur",
    surveyLink: generateSurveyLink(baseUrl, surveyId, t.token),
  }));

  // Send reminder emails
  const result = await sendSurveyEmails(
    recipients,
    survey.title_fr,
    "reminder"
  );

  // Update reminder_sent_at for successfully sent tokens
  if (result.sent > 0) {
    const failedEmails = new Set(result.errors.map((e) => e.email));
    const successIds = nonResponders
      .filter((t: any) => !failedEmails.has(t.email!))
      .map((t: any) => t.id);

    if (successIds.length > 0) {
      if (stCount && stCount > 0) {
        // Update survey_tokens
        await admin
          .from("survey_tokens")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("survey_id", surveyId)
          .in("token_id", successIds);
      } else {
        // Legacy: update anonymous_tokens
        await admin
          .from("anonymous_tokens")
          .update({ reminder_sent_at: new Date().toISOString() })
          .in("id", successIds);
      }
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
