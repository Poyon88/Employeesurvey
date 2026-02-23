import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";

type EmployeeRow = {
  employee_id: string;
  nom: string;
  email: string;
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
    if (n.includes("id employe") || n.includes("id_employe") || n.includes("employee id") || n.includes("employee_id") || n.includes("matricule"))
      headerMap["id_employe"] = h;
    else if (n.includes("nom") || n.includes("name")) headerMap["nom"] = h;
    else if (n.includes("email") || n.includes("mail")) headerMap["email"] = h;
    else if (n.includes("direction")) headerMap["direction"] = h;
    else if (n.includes("departement") || n.includes("department"))
      headerMap["departement"] = h;
    else if (n.includes("service")) headerMap["service"] = h;
  }

  const requiredCols = ["id_employe"];
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

    const employee_id = (row[headerMap["id_employe"]] || "").toString().trim();
    const nom = headerMap["nom"] ? (row[headerMap["nom"]] || "").toString().trim() : "";
    const email = headerMap["email"] ? (row[headerMap["email"]] || "").toString().trim().toLowerCase() : "";
    const direction = headerMap["direction"] ? (row[headerMap["direction"]] || "").toString().trim() : "";
    const departement = headerMap["departement"] ? (row[headerMap["departement"]] || "").toString().trim() : "";
    const service = headerMap["service"] ? (row[headerMap["service"]] || "").toString().trim() : "";

    if (!employee_id) {
      errors.push(`Ligne ${lineNum}: ID employé manquant`);
      continue;
    }

    if (email && !email.includes("@")) {
      errors.push(`Ligne ${lineNum}: email invalide "${email}"`);
      continue;
    }

    if (seenEmails.has(employee_id)) {
      errors.push(`Ligne ${lineNum}: ID employé en doublon "${employee_id}"`);
      continue;
    }
    seenEmails.add(employee_id);

    employees.push({ employee_id, nom, email, direction, departement, service });
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
  const societeId = formData.get("societe_id") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  if (!societeId) {
    return NextResponse.json({ error: "Veuillez sélectionner une société" }, { status: 400 });
  }

  // Use admin client for inserts (bypasses RLS)
  const admin = createAdminClient();

  // Validate that the société exists
  const { data: societe } = await admin
    .from("organizations")
    .select("id")
    .eq("id", societeId)
    .eq("type", "societe")
    .single();

  if (!societe) {
    return NextResponse.json({ error: "Société introuvable" }, { status: 404 });
  }

  const buffer = await file.arrayBuffer();
  const { employees, errors } = parseFile(buffer, file.name);

  if (errors.length > 0 && employees.length === 0) {
    return NextResponse.json({ errors, employees: [] }, { status: 400 });
  }

  // Build unique org units
  const directions = new Map<string, true>();
  const departments = new Map<string, string>(); // dept -> direction
  const services = new Map<string, string>(); // service -> dept

  for (const emp of employees) {
    if (emp.direction) {
      directions.set(emp.direction, true);
    }
    if (emp.departement && emp.direction) {
      departments.set(emp.departement, emp.direction);
    }
    if (emp.service && emp.departement) {
      services.set(emp.service, emp.departement);
    }
  }

  // Insert directions under the selected société
  const directionIds = new Map<string, string>();
  for (const dirName of directions.keys()) {
    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("name", dirName)
      .eq("type", "direction")
      .eq("parent_id", societeId)
      .single();

    if (existing) {
      directionIds.set(dirName, existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("organizations")
        .insert({ name: dirName, type: "direction", parent_id: societeId })
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

  // Generate or update anonymous tokens
  const tokenMappings: Array<{
    employee_id: string;
    email: string;
    nom: string;
    token: string;
    direction: string;
    departement: string;
    service: string;
    updated: boolean;
  }> = [];

  let updatedCount = 0;
  let createdCount = 0;

  for (const emp of employees) {
    const dirId = emp.direction ? directionIds.get(emp.direction) || null : null;
    const deptId = emp.departement
      ? departmentIds.get(emp.departement) || null
      : null;
    const svcId = emp.service ? serviceIds.get(emp.service) || null : null;

    // Check if a token already exists for this employee_id
    const { data: existingToken } = await admin
      .from("anonymous_tokens")
      .select("id, token")
      .eq("employee_id", emp.employee_id)
      .single();

    if (existingToken) {
      // Update existing token with new org structure
      const { error } = await admin
        .from("anonymous_tokens")
        .update({
          employee_name: emp.nom || null,
          email: emp.email || null,
          societe_id: societeId,
          direction_id: dirId,
          department_id: deptId,
          service_id: svcId,
        })
        .eq("id", existingToken.id);

      if (error) {
        return NextResponse.json(
          { error: `Erreur mise à jour token pour "${emp.employee_id}": ${error.message}` },
          { status: 500 }
        );
      }

      tokenMappings.push({
        employee_id: emp.employee_id,
        email: emp.email,
        nom: emp.nom,
        token: existingToken.token,
        direction: emp.direction,
        departement: emp.departement,
        service: emp.service,
        updated: true,
      });
      updatedCount++;
    } else {
      // Create new token
      const token = randomUUID();
      const { error } = await admin.from("anonymous_tokens").insert({
        token,
        employee_id: emp.employee_id,
        email: emp.email || null,
        employee_name: emp.nom || null,
        societe_id: societeId,
        direction_id: dirId,
        department_id: deptId,
        service_id: svcId,
      });

      if (error) {
        return NextResponse.json(
          { error: `Erreur token pour "${emp.employee_id}": ${error.message}` },
          { status: 500 }
        );
      }

      tokenMappings.push({
        employee_id: emp.employee_id,
        email: emp.email,
        nom: emp.nom,
        token,
        direction: emp.direction,
        departement: emp.departement,
        service: emp.service,
        updated: false,
      });
      createdCount++;
    }
  }

  return NextResponse.json({
    success: true,
    errors,
    summary: {
      employees: employees.length,
      directions: directions.size,
      departments: departments.size,
      services: services.size,
      tokens: createdCount,
      tokensUpdated: updatedCount,
    },
    tokenMappings,
  });
}
