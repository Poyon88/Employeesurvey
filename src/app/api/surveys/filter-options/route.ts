import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const societeIdsParam = searchParams.get("societe_ids");
  const societeIds = societeIdsParam ? societeIdsParam.split(",") : [];

  const admin = createAdminClient();

  // Fetch all active tokens, optionally filtered by societes
  const fullSelect = "direction_id, department_id, service_id, sexe, fonction, lieu_travail, type_contrat, temps_travail, cost_center, date_naissance, date_entree";
  const fallbackSelect = "direction_id, department_id, service_id";

  let hasDemoCols = true;
  let query = admin
    .from("anonymous_tokens")
    .select(fullSelect)
    .eq("active", true);

  if (societeIds.length > 0) {
    query = query.in("societe_id", societeIds);
  }

  let { data: tokens, error } = await query;

  if (error) {
    // Retry without demographic columns if they don't exist yet
    hasDemoCols = false;
    let fallbackQuery = admin
      .from("anonymous_tokens")
      .select(fallbackSelect)
      .eq("active", true);

    if (societeIds.length > 0) {
      fallbackQuery = fallbackQuery.in("societe_id", societeIds);
    }

    const fallbackResult = await fallbackQuery;
    if (fallbackResult.error) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération" },
        { status: 500 }
      );
    }
    tokens = fallbackResult.data as typeof tokens;
  }

  const tokensList = tokens || [];

  // Extract distinct values for each dimension
  const distinct = (key: string) => {
    const values = new Set<string>();
    tokensList.forEach((t: Record<string, unknown>) => {
      const val = t[key];
      if (val != null && val !== "") values.add(String(val));
    });
    return Array.from(values).sort();
  };

  // Load org names for direction, department, service IDs
  const orgIds = new Set<string>();
  tokensList.forEach((t: Record<string, unknown>) => {
    if (t.direction_id) orgIds.add(String(t.direction_id));
    if (t.department_id) orgIds.add(String(t.department_id));
    if (t.service_id) orgIds.add(String(t.service_id));
  });

  let orgMap: Record<string, { id: string; name: string; type: string; parent_id: string | null }> = {};
  if (orgIds.size > 0) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name, type, parent_id")
      .in("id", Array.from(orgIds));
    if (orgs) {
      orgs.forEach((o) => {
        orgMap[o.id] = o;
      });
    }
  }

  const directions = distinct("direction_id").map((id) => ({
    id,
    name: orgMap[id]?.name || id,
  }));
  const departments = distinct("department_id").map((id) => ({
    id,
    name: orgMap[id]?.name || id,
    parent_id: orgMap[id]?.parent_id || null,
  }));
  const services = distinct("service_id").map((id) => ({
    id,
    name: orgMap[id]?.name || id,
    parent_id: orgMap[id]?.parent_id || null,
  }));

  // Check if date fields have data
  const hasDateNaissance = hasDemoCols && tokensList.some((t: Record<string, unknown>) => t.date_naissance != null);
  const hasDateEntree = hasDemoCols && tokensList.some((t: Record<string, unknown>) => t.date_entree != null);

  return NextResponse.json({
    directions,
    departments,
    services,
    sexe: hasDemoCols ? distinct("sexe") : [],
    fonctions: hasDemoCols ? distinct("fonction") : [],
    lieux_travail: hasDemoCols ? distinct("lieu_travail") : [],
    types_contrat: hasDemoCols ? distinct("type_contrat") : [],
    temps_travail: hasDemoCols ? distinct("temps_travail") : [],
    cost_centers: hasDemoCols ? distinct("cost_center") : [],
    hasDateNaissance,
    hasDateEntree,
    totalTokens: tokensList.length,
  });
}
