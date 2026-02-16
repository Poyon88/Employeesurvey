import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionnaire } from "@/lib/ai/parse-questionnaire";
import mammoth from "mammoth";
import { extractText } from "unpdf";

export async function POST(request: NextRequest) {
  // Verify auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "hr_management"].includes(profile.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    let documentText = "";

    if (fileName.endsWith(".pdf")) {
      const buffer = await file.arrayBuffer();
      const result = await extractText(new Uint8Array(buffer));
      documentText = Array.isArray(result.text) ? result.text.join("\n") : result.text;
    } else if (fileName.endsWith(".docx")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      documentText = result.value;
    } else if (fileName.endsWith(".txt")) {
      documentText = await file.text();
    } else {
      return NextResponse.json(
        {
          error:
            "Format non supporté. Utilisez un fichier PDF, Word (.docx) ou texte (.txt).",
        },
        { status: 400 }
      );
    }

    if (!documentText.trim()) {
      return NextResponse.json(
        { error: "Le document ne contient pas de texte extractible." },
        { status: 400 }
      );
    }

    // Truncate very long documents to avoid token limits
    const maxChars = 50000;
    if (documentText.length > maxChars) {
      documentText = documentText.substring(0, maxChars);
    }

    const result = await parseQuestionnaire(documentText);

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI parse error:", error);
    const message =
      error instanceof Error ? error.message : "Erreur lors de l'analyse IA";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
