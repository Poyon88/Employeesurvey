import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  // Check survey exists and is not published
  const { data: survey } = await admin
    .from("surveys")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!survey) {
    return NextResponse.json({ error: "Sondage introuvable" }, { status: 404 });
  }

  if (survey.status === "published") {
    return NextResponse.json(
      { error: "Impossible de supprimer un sondage publié" },
      { status: 400 }
    );
  }

  // Delete related data first, then the survey
  const { error: respError } = await admin.from("responses").delete().eq("survey_id", id);
  console.log("Delete responses result:", respError ? respError.message : "ok");

  const { error: stError } = await admin.from("survey_tokens").delete().eq("survey_id", id);
  console.log("Delete survey_tokens result:", stError ? stError.message : "ok");

  if (respError) {
    return NextResponse.json(
      { error: `Erreur suppression réponses: ${respError.message}` },
      { status: 500 }
    );
  }

  const { error } = await admin.from("surveys").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `Erreur suppression sondage: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
