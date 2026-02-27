import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SurveyFilters } from "@/lib/types";
import { getFilteredTokens } from "@/lib/utils/token-filtering";

export async function POST(request: Request) {
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

  const body = await request.json();
  const { filters, survey_type, sample_percentage } = body as {
    filters: SurveyFilters;
    survey_type?: string;
    sample_percentage?: number;
  };

  const admin = createAdminClient();

  try {
    const tokens = await getFilteredTokens(admin, filters);
    const totalFiltered = tokens.length;

    let sampleSize: number | null = null;
    if (survey_type === "pulse" && sample_percentage) {
      sampleSize = Math.max(1, Math.round((totalFiltered * sample_percentage) / 100));
      if (sampleSize > totalFiltered) sampleSize = totalFiltered;
    }

    return NextResponse.json({
      totalFiltered,
      sampleSize,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
