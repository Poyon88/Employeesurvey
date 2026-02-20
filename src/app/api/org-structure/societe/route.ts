import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
