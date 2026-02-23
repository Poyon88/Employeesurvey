import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

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
  const name = (formData.get("name") as string | null)?.trim();
  const primaryColor = formData.get("primary_color") as string | null;
  const secondaryColor = formData.get("secondary_color") as string | null;
  const accentColor = formData.get("accent_color") as string | null;
  const fontFamily = formData.get("font_family") as string | null;
  const logoFile = formData.get("logo") as File | null;

  if (!name) {
    return NextResponse.json(
      { error: "Le nom de la société est requis" },
      { status: 400 }
    );
  }

  // Validate HEX colors if provided
  const colors = { primaryColor, secondaryColor, accentColor };
  for (const [key, value] of Object.entries(colors)) {
    if (value && !HEX_REGEX.test(value)) {
      return NextResponse.json(
        { error: `Couleur invalide pour ${key}: "${value}". Format attendu : #RRGGBB` },
        { status: 400 }
      );
    }
  }

  const admin = createAdminClient();

  // Check name uniqueness
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("name", name)
    .eq("type", "societe")
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `Une société nommée "${name}" existe déjà` },
      { status: 409 }
    );
  }

  // Insert société
  const { data: inserted, error: insertError } = await admin
    .from("organizations")
    .insert({
      name,
      type: "societe",
      parent_id: null,
      primary_color: primaryColor || null,
      secondary_color: secondaryColor || null,
      accent_color: accentColor || null,
      font_family: fontFamily || null,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: `Erreur création société : ${insertError.message}` },
      { status: 500 }
    );
  }

  // Upload logo if provided
  if (logoFile && logoFile.size > 0) {
    if (!logoFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Le logo doit être une image" },
        { status: 400 }
      );
    }

    const ext = logoFile.name.substring(logoFile.name.lastIndexOf(".")).toLowerCase();
    const filePath = `${inserted.id}${ext}`;
    const buffer = await logoFile.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from("logos")
      .upload(filePath, buffer, {
        contentType: logoFile.type,
        upsert: true,
      });

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = admin.storage.from("logos").getPublicUrl(filePath);

      await admin
        .from("organizations")
        .update({ logo_url: `${publicUrl}?v=${Date.now()}` })
        .eq("id", inserted.id);
    }
  }

  return NextResponse.json({ id: inserted.id });
}

export async function PUT(request: Request) {
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
  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string | null)?.trim();
  const primaryColor = formData.get("primary_color") as string | null;
  const secondaryColor = formData.get("secondary_color") as string | null;
  const accentColor = formData.get("accent_color") as string | null;
  const fontFamily = formData.get("font_family") as string | null;
  const logoFile = formData.get("logo") as File | null;

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json(
      { error: "Le nom de la société est requis" },
      { status: 400 }
    );
  }

  // Validate HEX colors if provided
  const colors = { primaryColor, secondaryColor, accentColor };
  for (const [key, value] of Object.entries(colors)) {
    if (value && !HEX_REGEX.test(value)) {
      return NextResponse.json(
        { error: `Couleur invalide pour ${key}: "${value}". Format attendu : #RRGGBB` },
        { status: 400 }
      );
    }
  }

  const admin = createAdminClient();

  // Check name uniqueness (exclude current société)
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("name", name)
    .eq("type", "societe")
    .neq("id", id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `Une société nommée "${name}" existe déjà` },
      { status: 409 }
    );
  }

  // Update société
  const { error: updateError } = await admin
    .from("organizations")
    .update({
      name,
      primary_color: primaryColor || null,
      secondary_color: secondaryColor || null,
      accent_color: accentColor || null,
      font_family: fontFamily || null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: `Erreur mise à jour société : ${updateError.message}` },
      { status: 500 }
    );
  }

  // Upload logo if provided
  if (logoFile && logoFile.size > 0) {
    if (!logoFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Le logo doit être une image" },
        { status: 400 }
      );
    }

    const ext = logoFile.name.substring(logoFile.name.lastIndexOf(".")).toLowerCase();
    const filePath = `${id}${ext}`;
    const buffer = await logoFile.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from("logos")
      .upload(filePath, buffer, {
        contentType: logoFile.type,
        upsert: true,
      });

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = admin.storage.from("logos").getPublicUrl(filePath);

      await admin
        .from("organizations")
        .update({ logo_url: `${publicUrl}?v=${Date.now()}` })
        .eq("id", id);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
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

  const { societeId } = await request.json();

  if (!societeId) {
    return NextResponse.json(
      { error: "societeId requis" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 1. Get all child organizations (directions, departments, services)
  const { data: allOrgs } = await admin
    .from("organizations")
    .select("id")
    .or(`id.eq.${societeId},parent_id.eq.${societeId}`);

  // Collect all org IDs recursively
  const orgIds = new Set<string>([societeId]);
  if (allOrgs) {
    for (const org of allOrgs) {
      orgIds.add(org.id);
    }
  }

  // Get deeper levels (departments under directions, services under departments)
  let depth = 0;
  let prevSize = 0;
  while (orgIds.size > prevSize && depth < 5) {
    prevSize = orgIds.size;
    const { data: children } = await admin
      .from("organizations")
      .select("id")
      .in("parent_id", Array.from(orgIds));

    if (children) {
      for (const child of children) {
        orgIds.add(child.id);
      }
    }
    depth++;
  }

  const orgIdsArray = Array.from(orgIds);

  // 2. Get surveys linked to this société
  const { data: surveys } = await admin
    .from("surveys")
    .select("id")
    .eq("societe_id", societeId);

  const surveyIds = (surveys || []).map((s) => s.id);

  // 3. Delete answers for these surveys
  if (surveyIds.length > 0) {
    // Get response IDs
    const { data: responses } = await admin
      .from("responses")
      .select("id")
      .in("survey_id", surveyIds);

    const responseIds = (responses || []).map((r) => r.id);

    if (responseIds.length > 0) {
      await admin.from("answers").delete().in("response_id", responseIds);
    }

    // 4. Delete responses
    await admin.from("responses").delete().in("survey_id", surveyIds);

    // 5. Delete survey sections, questions, options
    for (const surveyId of surveyIds) {
      const { data: sections } = await admin
        .from("sections")
        .select("id")
        .eq("survey_id", surveyId);

      const sectionIds = (sections || []).map((s) => s.id);

      if (sectionIds.length > 0) {
        const { data: questions } = await admin
          .from("questions")
          .select("id")
          .in("section_id", sectionIds);

        const questionIds = (questions || []).map((q) => q.id);

        if (questionIds.length > 0) {
          await admin.from("options").delete().in("question_id", questionIds);
          await admin.from("questions").delete().in("id", questionIds);
        }

        await admin.from("sections").delete().in("id", sectionIds);
      }
    }

    // 6. Delete surveys
    await admin.from("surveys").delete().in("id", surveyIds);
  }

  // 7. Delete anonymous tokens linked to this société
  await admin.from("anonymous_tokens").delete().eq("societe_id", societeId);

  // 8. Delete logo from storage if exists
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

  // 9. Delete all organizations (children first, then société)
  // Delete in reverse order: services, departments, directions, then société
  const childIds = orgIdsArray.filter((id) => id !== societeId);
  if (childIds.length > 0) {
    await admin.from("organizations").delete().in("id", childIds);
  }
  await admin.from("organizations").delete().eq("id", societeId);

  return NextResponse.json({ success: true });
}
