import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const societeId = formData.get("societeId") as string | null;

  if (!file || !societeId) {
    return NextResponse.json(
      { error: "Fichier et societeId requis" },
      { status: 400 }
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Le fichier doit être une image" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  const filePath = `${societeId}${ext}`;

  // Upload with admin client (bypasses RLS)
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from("logos")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("logos").getPublicUrl(filePath);

  const logoUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await admin
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", societeId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ logoUrl });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { societeId } = await request.json();

  if (!societeId) {
    return NextResponse.json(
      { error: "societeId requis" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Get current logo_url to find the file path
  const { data: org } = await admin
    .from("organizations")
    .select("logo_url")
    .eq("id", societeId)
    .single();

  if (org?.logo_url) {
    const url = org.logo_url.split("?")[0];
    const pathParts = url.split("/logos/");
    if (pathParts[1]) {
      await admin.storage.from("logos").remove([decodeURIComponent(pathParts[1])]);
    }
  }

  await admin
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", societeId);

  return NextResponse.json({ success: true });
}
