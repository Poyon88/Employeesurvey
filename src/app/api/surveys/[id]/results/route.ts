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
  const societeId = searchParams.get("societe_id");
  const directionId = searchParams.get("direction_id");
  const departmentId = searchParams.get("department_id");
  const serviceId = searchParams.get("service_id");
  const sexe = searchParams.get("sexe");
  const fonction = searchParams.get("fonction");
  const lieuTravail = searchParams.get("lieu_travail");
  const typeContrat = searchParams.get("type_contrat");
  const tempsTravail = searchParams.get("temps_travail");
  const costCenter = searchParams.get("cost_center");
  const ageMin = searchParams.get("age_min");
  const ageMax = searchParams.get("age_max");
  const seniorityMin = searchParams.get("seniority_min");
  const seniorityMax = searchParams.get("seniority_max");

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
    .select("id, societe_id, direction_id, department_id, service_id")
    .eq("survey_id", surveyId);

  if (societeId) responsesQuery = responsesQuery.eq("societe_id", societeId);
  if (directionId) responsesQuery = responsesQuery.eq("direction_id", directionId);
  if (departmentId) responsesQuery = responsesQuery.eq("department_id", departmentId);
  if (serviceId) responsesQuery = responsesQuery.eq("service_id", serviceId);

  // Demographic filters: find matching token_ids first, then filter responses
  const hasDemographicFilters = sexe || fonction || lieuTravail || typeContrat || tempsTravail || costCenter || ageMin || ageMax || seniorityMin || seniorityMax;

  if (hasDemographicFilters) {
    // Build a query on anonymous_tokens with demographic filters
    let tokenQuery = admin
      .from("anonymous_tokens")
      .select("id, date_naissance, date_entree")
      .eq("active", true);

    if (sexe) tokenQuery = tokenQuery.eq("sexe", sexe);
    if (fonction) tokenQuery = tokenQuery.eq("fonction", fonction);
    if (lieuTravail) tokenQuery = tokenQuery.eq("lieu_travail", lieuTravail);
    if (typeContrat) tokenQuery = tokenQuery.eq("type_contrat", typeContrat);
    if (tempsTravail) tokenQuery = tokenQuery.eq("temps_travail", tempsTravail);
    if (costCenter) tokenQuery = tokenQuery.eq("cost_center", costCenter);

    const { data: matchingTokens } = await tokenQuery;

    if (matchingTokens) {
      // Apply age/seniority filters in JS
      let filtered = matchingTokens;
      const now = new Date();

      if (ageMin || ageMax) {
        filtered = filtered.filter((t) => {
          if (!t.date_naissance) return false;
          const birth = new Date(t.date_naissance);
          let age = now.getFullYear() - birth.getFullYear();
          const m = now.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
          if (ageMin && age < Number(ageMin)) return false;
          if (ageMax && age > Number(ageMax)) return false;
          return true;
        });
      }

      if (seniorityMin || seniorityMax) {
        filtered = filtered.filter((t) => {
          if (!t.date_entree) return false;
          const entry = new Date(t.date_entree);
          let years = now.getFullYear() - entry.getFullYear();
          const m = now.getMonth() - entry.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < entry.getDate())) years--;
          if (seniorityMin && years < Number(seniorityMin)) return false;
          if (seniorityMax && years > Number(seniorityMax)) return false;
          return true;
        });
      }

      const matchingTokenIds = filtered.map((t) => t.id);
      if (matchingTokenIds.length > 0) {
        responsesQuery = responsesQuery.in("token_id", matchingTokenIds);
      } else {
        // No matching tokens - return empty results
        return NextResponse.json({
          survey: { id: survey.id, title_fr: survey.title_fr, title_en: survey.title_en },
          totalResponses: 0,
          sections: [],
          questions: [],
          organizations: [],
          demographicOptions: {},
          anonymityBlocked: false,
        });
      }
    }
  }

  // For managers, filter by allowed orgs
  if (allowedOrgIds) {
    responsesQuery = responsesQuery.or(
      `societe_id.in.(${allowedOrgIds.join(",")}),direction_id.in.(${allowedOrgIds.join(",")}),department_id.in.(${allowedOrgIds.join(",")}),service_id.in.(${allowedOrgIds.join(",")})`
    );
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

  // Load sections
  const { data: sectionRows } = await admin
    .from("survey_sections")
    .select("id, title_fr, sort_order")
    .eq("survey_id", surveyId)
    .order("sort_order");

  // Load questions
  const { data: questions } = await admin
    .from("questions")
    .select("id, type, text_fr, text_en, sort_order, section_id, question_options(id, text_fr, text_en, sort_order)")
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
    } else if (q.type === "likert" || q.type === "likert_5") {
      const maxScale = q.type === "likert_5" ? 5 : 10;
      const values = qAnswers
        .filter((a) => a.numeric_value !== null)
        .map((a) => a.numeric_value as number);

      const distribution: Record<number, number> = {};
      for (let i = 1; i <= maxScale; i++) distribution[i] = 0;
      values.forEach((v) => (distribution[v] = (distribution[v] || 0) + 1));

      const avg =
        values.length > 0
          ? values.reduce((s, v) => s + v, 0) / values.length
          : 0;

      aggregation = {
        type: q.type,
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
      section_id: (q as Record<string, unknown>).section_id || null,
      ...aggregation,
    };
  });

  // Get org breakdown for filters
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, type, parent_id")
    .order("name");

  // Get available demographic filter values from survey tokens
  let demographicOptions: Record<string, string[]> = {};

  // Get tokens linked to this survey (via survey_tokens or societe_id)
  const { data: surveyData } = await admin
    .from("surveys")
    .select("societe_id")
    .eq("id", surveyId)
    .single();

  let demoQuery = admin
    .from("anonymous_tokens")
    .select("sexe, fonction, lieu_travail, type_contrat, temps_travail, cost_center, date_naissance, date_entree")
    .eq("active", true);

  if (surveyData?.societe_id) {
    demoQuery = demoQuery.eq("societe_id", surveyData.societe_id);
  }

  const { data: demoTokens } = await demoQuery;

  if (demoTokens) {
    const distinct = (key: string) => {
      const values = new Set<string>();
      demoTokens.forEach((t: Record<string, unknown>) => {
        const v = t[key];
        if (v != null && v !== "") values.add(String(v));
      });
      return Array.from(values).sort();
    };

    demographicOptions = {
      sexe: distinct("sexe"),
      fonctions: distinct("fonction"),
      lieux_travail: distinct("lieu_travail"),
      types_contrat: distinct("type_contrat"),
      temps_travail: distinct("temps_travail"),
      cost_centers: distinct("cost_center"),
    };

    // Flag if date fields have data
    if (demoTokens.some((t: Record<string, unknown>) => t.date_naissance != null)) {
      demographicOptions.hasDateNaissance = ["true"];
    }
    if (demoTokens.some((t: Record<string, unknown>) => t.date_entree != null)) {
      demographicOptions.hasDateEntree = ["true"];
    }
  }

  return NextResponse.json({
    survey: {
      id: survey.id,
      title_fr: survey.title_fr,
      title_en: survey.title_en,
    },
    totalResponses,
    sections: sectionRows || [],
    questions: questionResults,
    organizations: orgs || [],
    demographicOptions,
    anonymityBlocked: false,
  });
}
