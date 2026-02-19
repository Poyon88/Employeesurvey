import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { token, answers } = body as {
      token: string;
      answers: {
        question_id: string;
        numeric_value?: number;
        text_value?: string;
        selected_option_ids?: string[];
      }[];
    };

    if (!token) {
      return NextResponse.json(
        { error: "Token manquant" },
        { status: 400 }
      );
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "Aucune réponse fournie" },
        { status: 400 }
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("anonymous_tokens")
      .select("id, societe_id, direction_id, department_id, service_id")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: "Token invalide" },
        { status: 403 }
      );
    }

    // Validate survey is published
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .select("id, status")
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
        { error: "Ce sondage n'est pas ouvert aux réponses" },
        { status: 400 }
      );
    }

    // Check if token already submitted for this survey
    const { data: existingResponse } = await supabase
      .from("responses")
      .select("id")
      .eq("survey_id", surveyId)
      .eq("token_id", tokenData.id)
      .single();

    if (existingResponse) {
      return NextResponse.json(
        { error: "Vous avez déjà répondu à ce sondage" },
        { status: 409 }
      );
    }

    // Create response
    const { data: response, error: responseError } = await supabase
      .from("responses")
      .insert({
        survey_id: surveyId,
        token_id: tokenData.id,
        societe_id: tokenData.societe_id,
        direction_id: tokenData.direction_id,
        department_id: tokenData.department_id,
        service_id: tokenData.service_id,
      })
      .select("id")
      .single();

    if (responseError || !response) {
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement" },
        { status: 500 }
      );
    }

    // Insert answers
    const answersToInsert = answers.map((a) => ({
      response_id: response.id,
      question_id: a.question_id,
      numeric_value: a.numeric_value ?? null,
      text_value: a.text_value ?? null,
      selected_option_ids: a.selected_option_ids ?? null,
    }));

    const { error: answersError } = await supabase
      .from("answers")
      .insert(answersToInsert);

    if (answersError) {
      // Rollback: delete the response
      await supabase.from("responses").delete().eq("id", response.id);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement des réponses" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
