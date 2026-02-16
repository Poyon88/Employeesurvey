import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ANONYMITY_THRESHOLD } from "@/lib/utils/anonymity";

export async function GET(
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

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Get filter params
  const { searchParams } = new URL(request.url);
  const directionId = searchParams.get("direction_id");
  const departmentId = searchParams.get("department_id");
  const serviceId = searchParams.get("service_id");

  // For managers, restrict to their assigned org units
  let allowedOrgIds: string[] | null = null;
  if (profile.role === "manager") {
    const { data: assignments } = await admin
      .from("manager_assignments")
      .select("organization_id")
      .eq("manager_id", user.id);

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({
        survey: null,
        totalResponses: 0,
        questions: [],
        message: "Aucune unité organisationnelle assignée",
      });
    }

    allowedOrgIds = assignments.map((a) => a.organization_id);
  }

  // Load survey
  const { data: survey } = await admin
    .from("surveys")
    .select("id, title_fr, title_en, status")
    .eq("id", surveyId)
    .single();

  if (!survey) {
    return NextResponse.json({ error: "Sondage introuvable" }, { status: 404 });
  }

  // Build responses query with org filters
  let responsesQuery = admin
    .from("responses")
    .select("id, direction_id, department_id, service_id")
    .eq("survey_id", surveyId);

  if (directionId) responsesQuery = responsesQuery.eq("direction_id", directionId);
  if (departmentId) responsesQuery = responsesQuery.eq("department_id", departmentId);
  if (serviceId) responsesQuery = responsesQuery.eq("service_id", serviceId);

  // For managers, filter by allowed orgs
  if (allowedOrgIds) {
    responsesQuery = responsesQuery.in("direction_id", allowedOrgIds)
      .or(`department_id.in.(${allowedOrgIds.join(",")}),service_id.in.(${allowedOrgIds.join(",")})`);
  }

  const { data: responses } = await responsesQuery;
  const totalResponses = responses?.length || 0;

  // Anonymity check
  if (totalResponses < ANONYMITY_THRESHOLD) {
    return NextResponse.json({
      survey: { id: survey.id, title_fr: survey.title_fr, title_en: survey.title_en },
      totalResponses,
      questions: [],
      anonymityBlocked: true,
      message: `Résultats masqués : moins de ${ANONYMITY_THRESHOLD} répondants (${totalResponses} reçus)`,
    });
  }

  const responseIds = responses!.map((r) => r.id);

  // Load questions
  const { data: questions } = await admin
    .from("questions")
    .select("id, type, text_fr, text_en, sort_order, question_options(id, text_fr, text_en, sort_order)")
    .eq("survey_id", surveyId)
    .order("sort_order");

  if (!questions) {
    return NextResponse.json({ error: "Erreur chargement questions" }, { status: 500 });
  }

  // Load all answers for these responses
  const { data: allAnswers } = await admin
    .from("answers")
    .select("question_id, numeric_value, text_value, selected_option_ids")
    .in("response_id", responseIds);

  // Aggregate per question
  const questionResults = questions.map((q) => {
    const qAnswers = (allAnswers || []).filter(
      (a) => a.question_id === q.id
    );
    const options = ((q.question_options as { id: string; text_fr: string; text_en: string | null; sort_order: number }[]) || []).sort(
      (a, b) => a.sort_order - b.sort_order
    );

    let aggregation: Record<string, unknown> = {};

    if (q.type === "single_choice" || q.type === "multiple_choice") {
      // Count per option
      const optionCounts: Record<string, number> = {};
      options.forEach((o) => (optionCounts[o.id] = 0));

      qAnswers.forEach((a) => {
        if (a.selected_option_ids) {
          (a.selected_option_ids as string[]).forEach((optId) => {
            optionCounts[optId] = (optionCounts[optId] || 0) + 1;
          });
        }
      });

      aggregation = {
        type: "choices",
        options: options.map((o) => ({
          id: o.id,
          text_fr: o.text_fr,
          text_en: o.text_en,
          count: optionCounts[o.id] || 0,
          percentage:
            qAnswers.length > 0
              ? Math.round(((optionCounts[o.id] || 0) / qAnswers.length) * 100)
              : 0,
        })),
        totalAnswers: qAnswers.length,
      };
    } else if (q.type === "likert") {
      const values = qAnswers
        .filter((a) => a.numeric_value !== null)
        .map((a) => a.numeric_value as number);

      const distribution: Record<number, number> = {};
      for (let i = 1; i <= 10; i++) distribution[i] = 0;
      values.forEach((v) => (distribution[v] = (distribution[v] || 0) + 1));

      const avg =
        values.length > 0
          ? values.reduce((s, v) => s + v, 0) / values.length
          : 0;

      aggregation = {
        type: "likert",
        average: Math.round(avg * 10) / 10,
        distribution: Object.entries(distribution).map(([val, count]) => ({
          value: Number(val),
          count,
        })),
        totalAnswers: values.length,
      };
    } else if (q.type === "free_text") {
      aggregation = {
        type: "free_text",
        responses: qAnswers
          .filter((a) => a.text_value?.trim())
          .map((a) => a.text_value),
        totalAnswers: qAnswers.filter((a) => a.text_value?.trim()).length,
      };
    }

    return {
      id: q.id,
      type: q.type,
      text_fr: q.text_fr,
      text_en: q.text_en,
      sort_order: q.sort_order,
      ...aggregation,
    };
  });

  // Get org breakdown for filters
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, type, parent_id")
    .order("name");

  return NextResponse.json({
    survey: {
      id: survey.id,
      title_fr: survey.title_fr,
      title_en: survey.title_en,
    },
    totalResponses,
    questions: questionResults,
    organizations: orgs || [],
    anonymityBlocked: false,
  });
}
