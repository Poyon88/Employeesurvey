import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SurveyFilters } from "@/lib/types";
import { getFilteredTokens } from "@/lib/utils/token-filtering";
import { sampleTokens } from "@/lib/utils/sampling";

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

  const admin = createAdminClient();

  // Load survey
  const { data: survey, error: surveyError } = await admin
    .from("surveys")
    .select("id, survey_type, sample_percentage, filters, societe_id")
    .eq("id", surveyId)
    .single();

  if (surveyError || !survey) {
    return NextResponse.json(
      { error: "Sondage introuvable" },
      { status: 404 }
    );
  }

  // Build filters - if no explicit filters set, default to survey's societe_id
  const filters: SurveyFilters = (survey.filters as SurveyFilters) || {};
  if (
    (!filters.societe_ids || filters.societe_ids.length === 0) &&
    survey.societe_id
  ) {
    filters.societe_ids = [survey.societe_id];
  }

  try {
    // Get filtered tokens
    let selectedTokens = await getFilteredTokens(admin, filters);

    // For pulse surveys, apply sampling
    if (survey.survey_type === "pulse" && survey.sample_percentage) {
      selectedTokens = sampleTokens(selectedTokens, Number(survey.sample_percentage));
    }

    // Clear existing survey_tokens for this survey
    await admin.from("survey_tokens").delete().eq("survey_id", surveyId);

    // Insert new survey_tokens in batches of 500
    const batchSize = 500;
    let insertedCount = 0;

    for (let i = 0; i < selectedTokens.length; i += batchSize) {
      const batch = selectedTokens.slice(i, i + batchSize).map((t) => ({
        survey_id: surveyId,
        token_id: t.id,
        selected_by: survey.survey_type === "pulse" ? "sample" : "filter",
      }));

      const { error } = await admin.from("survey_tokens").insert(batch);
      if (error) {
        return NextResponse.json(
          { error: `Erreur lors de l'insertion: ${error.message}` },
          { status: 500 }
        );
      }
      insertedCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      totalFiltered: selectedTokens.length,
      inserted: insertedCount,
      surveyType: survey.survey_type,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
