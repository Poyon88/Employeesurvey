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

  // Check that the token exists and belongs to a société linked to this survey
  const { data: tokenData } = await supabase
    .from("anonymous_tokens")
    .select("id, societe_id")
    .eq("token", token.trim())
    .single();

  if (!tokenData) {
    return NextResponse.json({ valid: false });
  }

  // Verify the token's société matches the survey's société
  const { data: survey } = await supabase
    .from("surveys")
    .select("societe_id")
    .eq("id", surveyId)
    .single();

  if (!survey || survey.societe_id !== tokenData.societe_id) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true });
}
