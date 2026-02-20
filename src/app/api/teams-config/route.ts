import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTeamsConfigured } from "@/lib/teams/graph";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json({ configured: isTeamsConfigured() });
}
