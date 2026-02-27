import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamsMessages, isTeamsConfigured } from "@/lib/teams/graph";
import { generateSurveyLink } from "@/lib/utils/token";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;

  if (!isTeamsConfigured()) {
    return NextResponse.json(
      { error: "Microsoft Teams n'est pas configuré. Contactez votre administrateur pour définir les variables AZURE_TENANT_ID, AZURE_CLIENT_ID et AZURE_CLIENT_SECRET." },
      { status: 400 }
    );
  }

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

  // Check if survey_tokens exist for this survey
  const { count: stCount } = await admin
    .from("survey_tokens")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", surveyId);

  let uninvitedTokens;

  if (stCount && stCount > 0) {
    // New behavior: use survey_tokens
    const { data: surveyTokensData, error: stError } = await admin
      .from("survey_tokens")
      .select("token_id, teams_invitation_sent_at, anonymous_tokens!inner(id, token, email, employee_name)")
      .eq("survey_id", surveyId)
      .is("teams_invitation_sent_at", null);

    if (stError) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des tokens" },
        { status: 500 }
      );
    }

    uninvitedTokens = (surveyTokensData || [])
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
      .is("teams_invitation_sent_at", null);

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
    uninvitedTokens = data || [];
  }

  if (!uninvitedTokens || uninvitedTokens.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      failed: 0,
      total: 0,
      message: "Toutes les invitations Teams ont déjà été envoyées",
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

  // Send Teams messages
  try {
    const result = await sendTeamsMessages(
      recipients,
      survey.title_fr,
      "invitation"
    );

    // Update teams_invitation_sent_at for successfully sent tokens
    if (result.sent > 0) {
      const failedEmails = new Set(result.errors.map((e) => e.email));
      const successIds = uninvitedTokens
        .filter((t: any) => !failedEmails.has(t.email!))
        .map((t: any) => t.id);

      if (successIds.length > 0) {
        if (stCount && stCount > 0) {
          // Update survey_tokens
          await admin
            .from("survey_tokens")
            .update({ teams_invitation_sent_at: new Date().toISOString() })
            .eq("survey_id", surveyId)
            .in("token_id", successIds);
        } else {
          // Legacy: update anonymous_tokens
          await admin
            .from("anonymous_tokens")
            .update({ teams_invitation_sent_at: new Date().toISOString() })
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de l'envoi Teams" },
      { status: 500 }
    );
  }
}
