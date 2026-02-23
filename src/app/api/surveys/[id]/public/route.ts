import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const supabase = createAdminClient();
  const isPreview = request.nextUrl.searchParams.get("preview") === "1";

  // Load survey
  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .select("id, title_fr, description_fr, introduction_fr, status, societe_id")
    .eq("id", surveyId)
    .single();

  if (surveyError || !survey) {
    return NextResponse.json(
      { error: "Sondage introuvable" },
      { status: 404 }
    );
  }

  if (!isPreview) {
    if (survey.status === "closed") {
      return NextResponse.json(
        { error: "Ce sondage est clôturé et n'accepte plus de réponses." },
        { status: 403 }
      );
    }
    if (survey.status !== "published") {
      return NextResponse.json(
        { error: "Ce sondage n'est pas disponible" },
        { status: 403 }
      );
    }
  }

  // Load branding from the linked organization
  let branding: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    font_family: string | null;
  } | null = null;

  if (survey.societe_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name, logo_url, primary_color, secondary_color, accent_color, font_family")
      .eq("id", survey.societe_id)
      .single();

    if (org) {
      branding = org;
    }
  }

  // Load sections
  const { data: sections } = await supabase
    .from("survey_sections")
    .select("id, title_fr, sort_order")
    .eq("survey_id", surveyId)
    .order("sort_order");

  // Load questions with options
  const { data: questions } = await supabase
    .from("questions")
    .select(
      "id, type, text_fr, required, sort_order, section_id, question_options(id, text_fr, sort_order)"
    )
    .eq("survey_id", surveyId)
    .order("sort_order");

  return NextResponse.json({
    survey,
    branding,
    sections: sections || [],
    questions: (questions || []).map((q) => ({
      ...q,
      options: (
        (q.question_options as { id: string; text_fr: string; sort_order: number }[]) || []
      ).sort((a, b) => a.sort_order - b.sort_order),
    })),
  });
}
