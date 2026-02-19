import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";

type EmployeeRow = {
  nom: string;
  email: string;
  societe: string;
  direction: string;
  departement: string;
  service: string;
};

type ParsedData = {
  employees: EmployeeRow[];
  errors: string[];
};

function parseFile(buffer: ArrayBuffer, filename: string): ParsedData {
  const errors: string[] = [];
  const employees: EmployeeRow[] = [];

  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  if (rows.length === 0) {
    errors.push("Le fichier est vide");
    return { employees, errors };
  }

  // Normalize column headers (lowercase, trim, remove accents)
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const firstRow = rows[0];
  const headers = Object.keys(firstRow);
  const headerMap: Record<string, string> = {};

  for (const h of headers) {
    const n = normalize(h);
    if (n.includes("nom") || n.includes("name")) headerMap["nom"] = h;
    else if (n.includes("email") || n.includes("mail")) headerMap["email"] = h;
    else if (n.includes("societe") || n.includes("company")) headerMap["societe"] = h;
    else if (n.includes("direction")) headerMap["direction"] = h;
    else if (n.includes("departement") || n.includes("department"))
      headerMap["departement"] = h;
    else if (n.includes("service")) headerMap["service"] = h;
  }

  const requiredCols = ["nom", "email", "societe", "direction", "departement", "service"];
  for (const col of requiredCols) {
    if (!headerMap[col]) {
      errors.push(
        `Colonne "${col}" introuvable. Colonnes détectées : ${headers.join(", ")}`
      );
    }
  }

  if (errors.length > 0) {
    return { employees, errors };
  }

  const seenEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // +2 for header + 0-index

    const nom = (row[headerMap["nom"]] || "").toString().trim();
    const email = (row[headerMap["email"]] || "").toString().trim().toLowerCase();
    const societe = (row[headerMap["societe"]] || "").toString().trim();
    const direction = (row[headerMap["direction"]] || "").toString().trim();
    const departement = (row[headerMap["departement"]] || "").toString().trim();
    const service = (row[headerMap["service"]] || "").toString().trim();

    if (!nom) {
      errors.push(`Ligne ${lineNum}: nom manquant`);
      continue;
    }
    if (!email || !email.includes("@")) {
      errors.push(`Ligne ${lineNum}: email invalide "${email}"`);
      continue;
    }
    if (!societe) {
      errors.push(`Ligne ${lineNum}: société manquante`);
      continue;
    }
    if (!direction) {
      errors.push(`Ligne ${lineNum}: direction manquante`);
      continue;
    }

    if (seenEmails.has(email)) {
      errors.push(`Ligne ${lineNum}: email en doublon "${email}"`);
      continue;
    }
    seenEmails.add(email);

    employees.push({ nom, email, societe, direction, departement, service });
  }

  return { employees, errors };
}

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

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Parse uploaded file
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { employees, errors } = parseFile(buffer, file.name);

  if (errors.length > 0 && employees.length === 0) {
    return NextResponse.json({ errors, employees: [] }, { status: 400 });
  }

  // Use admin client for inserts (bypasses RLS)
  const admin = createAdminClient();

  // Build unique org units
  const societes = new Set<string>();
  const directions = new Map<string, string>(); // direction -> societe
  const departments = new Map<string, string>(); // dept -> direction
  const services = new Map<string, string>(); // service -> dept

  for (const emp of employees) {
    societes.add(emp.societe);
    directions.set(emp.direction, emp.societe);
    if (emp.departement) {
      departments.set(emp.departement, emp.direction);
    }
    if (emp.service && emp.departement) {
      services.set(emp.service, emp.departement);
    }
  }

  // Insert societes
  const societeIds = new Map<string, string>();
  for (const socName of societes) {
    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("name", socName)
      .eq("type", "societe")
      .single();

    if (existing) {
      societeIds.set(socName, existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("organizations")
        .insert({ name: socName, type: "societe", parent_id: null })
        .select("id")
        .single();

      if (error) {
        return NextResponse.json(
          { error: `Erreur création société "${socName}": ${error.message}` },
          { status: 500 }
        );
      }
      societeIds.set(socName, inserted.id);
    }
  }

  // Insert directions
  const directionIds = new Map<string, string>();
  for (const [dirName, socName] of directions) {
    const parentId = societeIds.get(socName)!;

    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("name", dirName)
      .eq("type", "direction")
      .eq("parent_id", parentId)
      .single();

    if (existing) {
      directionIds.set(dirName, existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("organizations")
        .insert({ name: dirName, type: "direction", parent_id: parentId })
        .select("id")
        .single();

      if (error) {
        return NextResponse.json(
          { error: `Erreur création direction "${dirName}": ${error.message}` },
          { status: 500 }
        );
      }
      directionIds.set(dirName, inserted.id);
    }
  }

  // Insert departments
  const departmentIds = new Map<string, string>();
  for (const [deptName, dirName] of departments) {
    const parentId = directionIds.get(dirName)!;

    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("name", deptName)
      .eq("type", "department")
      .eq("parent_id", parentId)
      .single();

    if (existing) {
      departmentIds.set(deptName, existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("organizations")
        .insert({ name: deptName, type: "department", parent_id: parentId })
        .select("id")
        .single();

      if (error) {
        return NextResponse.json(
          { error: `Erreur création département "${deptName}": ${error.message}` },
          { status: 500 }
        );
      }
      departmentIds.set(deptName, inserted.id);
    }
  }

  // Insert services
  const serviceIds = new Map<string, string>();
  for (const [svcName, deptName] of services) {
    const parentId = departmentIds.get(deptName)!;

    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("name", svcName)
      .eq("type", "service")
      .eq("parent_id", parentId)
      .single();

    if (existing) {
      serviceIds.set(svcName, existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("organizations")
        .insert({ name: svcName, type: "service", parent_id: parentId })
        .select("id")
        .single();

      if (error) {
        return NextResponse.json(
          { error: `Erreur création service "${svcName}": ${error.message}` },
          { status: 500 }
        );
      }
      serviceIds.set(svcName, inserted.id);
    }
  }

  // Generate anonymous tokens
  const tokenMappings: Array<{
    email: string;
    nom: string;
    token: string;
    societe: string;
    direction: string;
    departement: string;
    service: string;
  }> = [];

  for (const emp of employees) {
    const token = randomUUID();
    const socId = societeIds.get(emp.societe) || null;
    const dirId = directionIds.get(emp.direction) || null;
    const deptId = emp.departement
      ? departmentIds.get(emp.departement) || null
      : null;
    const svcId = emp.service ? serviceIds.get(emp.service) || null : null;

    const { error } = await admin.from("anonymous_tokens").insert({
      token,
      email: emp.email,
      employee_name: emp.nom,
      societe_id: socId,
      direction_id: dirId,
      department_id: deptId,
      service_id: svcId,
    });

    if (error) {
      return NextResponse.json(
        { error: `Erreur token pour "${emp.email}": ${error.message}` },
        { status: 500 }
      );
    }

    tokenMappings.push({
      email: emp.email,
      nom: emp.nom,
      token,
      societe: emp.societe,
      direction: emp.direction,
      departement: emp.departement,
      service: emp.service,
    });
  }

  return NextResponse.json({
    success: true,
    errors,
    summary: {
      employees: employees.length,
      societes: societes.size,
      directions: directions.size,
      departments: departments.size,
      services: services.size,
      tokens: tokenMappings.length,
    },
    tokenMappings,
  });
}
