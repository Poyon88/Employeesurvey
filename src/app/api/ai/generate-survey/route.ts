import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSurvey } from "@/lib/ai/generate-survey";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "hr_management"].includes(profile.role)) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { prompt, template, questionCount, allowedTypes } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return NextResponse.json(
        { error: "Veuillez decrire le sondage souhaite (minimum 5 caracteres)" },
        { status: 400 }
      );
    }

    const result = await generateSurvey({
      prompt: prompt.trim(),
      template,
      questionCount: questionCount ? Number(questionCount) : undefined,
      allowedTypes,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("AI generate-survey error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la generation du sondage par l'IA" },
      { status: 500 }
    );
  }
}
