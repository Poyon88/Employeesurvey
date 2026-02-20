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

  const admin = createAdminClient();

  // Get the survey and its wave group
  const { data: survey } = await admin
    .from("surveys")
    .select("id, title_fr, wave_group_id, wave_number")
    .eq("id", surveyId)
    .single();

  if (!survey || !survey.wave_group_id) {
    return NextResponse.json({
      error: "Ce sondage n'appartient pas à un groupe de vagues",
    }, { status: 400 });
  }

  // Get wave group info
  const { data: waveGroup } = await admin
    .from("wave_groups")
    .select("id, name")
    .eq("id", survey.wave_group_id)
    .single();

  // Get all surveys in this wave group
  const { data: waveSurveys } = await admin
    .from("surveys")
    .select("id, title_fr, wave_number, status, published_at")
    .eq("wave_group_id", survey.wave_group_id)
    .order("wave_number");

  if (!waveSurveys || waveSurveys.length === 0) {
    return NextResponse.json({
      waveGroup,
      waves: [],
    });
  }

  // Get Likert questions from the current survey (reference for matching)
  const { data: likertQuestions } = await admin
    .from("questions")
    .select("id, text_fr, text_en, sort_order, question_code")
    .eq("survey_id", surveyId)
    .in("type", ["likert", "likert_5"])
    .order("sort_order");

  const refQuestions = likertQuestions || [];

  // For each wave survey, calculate averages for matching Likert questions
  const waveData = [];

  for (const ws of waveSurveys) {
    // Get response count
    const { count: responseCount } = await admin
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("survey_id", ws.id);

    const total = responseCount || 0;

    if (total < ANONYMITY_THRESHOLD) {
      waveData.push({
        surveyId: ws.id,
        title: ws.title_fr,
        waveNumber: ws.wave_number,
        status: ws.status,
        publishedAt: ws.published_at,
        responseCount: total,
        anonymityBlocked: true,
        questionAverages: [],
      });
      continue;
    }

    // Get response IDs
    const { data: responses } = await admin
      .from("responses")
      .select("id")
      .eq("survey_id", ws.id);

    const responseIds = (responses || []).map((r) => r.id);

    // Get Likert questions for this wave's survey
    const { data: waveQuestions } = await admin
      .from("questions")
      .select("id, text_fr, sort_order, question_code")
      .eq("survey_id", ws.id)
      .in("type", ["likert", "likert_5"])
      .order("sort_order");

    // Match wave questions to reference questions by question_code (preferred) or positional fallback
    const questionAverages = [];

    for (let ri = 0; ri < refQuestions.length; ri++) {
      const ref = refQuestions[ri];

      // Find the matching wave question: first try question_code, then fall back to position
      let matchedWq = null;
      if (ref.question_code) {
        matchedWq = (waveQuestions || []).find(
          (wq) => wq.question_code === ref.question_code
        );
      }
      if (!matchedWq) {
        matchedWq = (waveQuestions || [])[ri] || null;
      }

      if (!matchedWq) {
        questionAverages.push({
          questionCode: ref.question_code || null,
          questionId: ref.id,
          text_fr: ref.text_fr,
          sortOrder: ref.sort_order,
          average: null,
          answerCount: 0,
        });
        continue;
      }

      const { data: answers } = await admin
        .from("answers")
        .select("numeric_value")
        .eq("question_id", matchedWq.id)
        .in("response_id", responseIds);

      const values = (answers || [])
        .filter((a) => a.numeric_value !== null)
        .map((a) => a.numeric_value as number);

      const avg =
        values.length > 0
          ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
          : null;

      questionAverages.push({
        questionCode: ref.question_code || null,
        questionId: matchedWq.id,
        text_fr: ref.text_fr,
        sortOrder: ref.sort_order,
        average: avg,
        answerCount: values.length,
      });
    }

    waveData.push({
      surveyId: ws.id,
      title: ws.title_fr,
      waveNumber: ws.wave_number,
      status: ws.status,
      publishedAt: ws.published_at,
      responseCount: total,
      anonymityBlocked: false,
      questionAverages,
    });
  }

  return NextResponse.json({
    waveGroup,
    currentSurveyId: surveyId,
    waves: waveData,
    referenceQuestions: refQuestions,
  });
}
