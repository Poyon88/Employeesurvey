import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const supabase = createAdminClient();

  const body = await request.json();
  const { token } = body as { token: string };

  if (!token?.trim()) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  // Check that the token exists and is active
  const { data: tokenData } = await supabase
    .from("anonymous_tokens")
    .select("id, societe_id")
    .eq("token", token.trim())
    .eq("active", true)
    .single();

  if (!tokenData) {
    return NextResponse.json({ valid: false });
  }

  // Check if survey_tokens exist for this survey
  const { count: surveyTokenCount } = await supabase
    .from("survey_tokens")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", surveyId);

  if (surveyTokenCount && surveyTokenCount > 0) {
    // New behavior: check survey_tokens junction table
    const { data: surveyToken } = await supabase
      .from("survey_tokens")
      .select("id")
      .eq("survey_id", surveyId)
      .eq("token_id", tokenData.id)
      .single();

    if (!surveyToken) {
      return NextResponse.json({ valid: false });
    }
  } else {
    // Fallback: legacy behavior - check societe_id match
    const { data: survey } = await supabase
      .from("surveys")
      .select("societe_id")
      .eq("id", surveyId)
      .single();

    if (!survey || survey.societe_id !== tokenData.societe_id) {
      return NextResponse.json({ valid: false });
    }
  }

  return NextResponse.json({ valid: true });
}
