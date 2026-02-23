import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { AVAILABLE_LANGUAGES } from "@/lib/utils/languages";

type TranslationPayload = {
  survey: { title: string; description: string; introduction: string };
  sections: Record<string, { title: string }>;
  questions: Record<string, { text: string }>;
  options: Record<string, { text: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang");

  if (!lang || lang === "fr") {
    return NextResponse.json(
      { error: "Langue invalide ou non spécifiée" },
      { status: 400 }
    );
  }

  const validCodes = AVAILABLE_LANGUAGES.map((l) => l.code);
  if (!validCodes.includes(lang as (typeof validCodes)[number])) {
    return NextResponse.json(
      { error: `Langue non supportée : ${lang}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Check survey exists and is published
  const { data: survey } = await admin
    .from("surveys")
    .select(
      "id, title_fr, description_fr, introduction_fr, status"
    )
    .eq("id", surveyId)
    .single();

  if (!survey) {
    return NextResponse.json(
      { error: "Sondage introuvable" },
      { status: 404 }
    );
  }

  if (survey.status !== "published") {
    return NextResponse.json(
      { error: "Sondage non publié" },
      { status: 400 }
    );
  }

  // Check cache
  const { data: cached } = await admin
    .from("survey_translations_cache")
    .select("translations")
    .eq("survey_id", surveyId)
    .eq("language", lang)
    .single();

  if (cached) {
    return NextResponse.json(cached.translations);
  }

  // No cache — translate via AI
  const { data: sectionRows } = await admin
    .from("survey_sections")
    .select("id, title_fr")
    .eq("survey_id", surveyId)
    .order("sort_order");

  const { data: questions } = await admin
    .from("questions")
    .select(
      "id, text_fr, type, question_options(id, text_fr)"
    )
    .eq("survey_id", surveyId)
    .order("sort_order");

  if (!questions) {
    return NextResponse.json(
      { error: "Erreur chargement questions" },
      { status: 500 }
    );
  }

  // Build source text for translation
  const langInfo = AVAILABLE_LANGUAGES.find((l) => l.code === lang);
  const targetLanguage = langInfo?.nativeLabel || lang;

  const sourceData: {
    survey: { title: string; description: string; introduction: string };
    sections: { id: string; title: string }[];
    questions: { id: string; text: string }[];
    options: { id: string; text: string }[];
  } = {
    survey: {
      title: survey.title_fr,
      description: survey.description_fr || "",
      introduction: survey.introduction_fr || "",
    },
    sections: (sectionRows || []).map((s) => ({ id: s.id, title: s.title_fr })),
    questions: [],
    options: [],
  };

  for (const q of questions) {
    sourceData.questions.push({ id: q.id, text: q.text_fr });
    const opts = (
      q.question_options as { id: string; text_fr: string }[]
    ) || [];
    for (const o of opts) {
      sourceData.options.push({ id: o.id, text: o.text_fr });
    }
  }

  // Call Claude for translation
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurée" },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  const prompt = `Traduis le contenu suivant du français vers le ${targetLanguage}.

Retourne UNIQUEMENT un JSON valide (pas de markdown, pas de texte autour) avec cette structure exacte :
{
  "survey": { "title": "...", "description": "...", "introduction": "..." },
  "sections": { "<section_id>": { "title": "..." }, ... },
  "questions": { "<question_id>": { "text": "..." }, ... },
  "options": { "<option_id>": { "text": "..." }, ... }
}

Conserve les IDs tels quels. Traduis uniquement les valeurs textuelles.
Si un champ source est vide, laisse-le vide dans la traduction.

Contenu source :
${JSON.stringify(sourceData, null, 2)}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    const translations: TranslationPayload = JSON.parse(jsonStr);

    // Ensure sections key exists (may be empty)
    if (!translations.sections) translations.sections = {};

    // Validate structure
    if (!translations.survey || !translations.questions || !translations.options) {
      return NextResponse.json(
        { error: "Format de traduction IA invalide" },
        { status: 500 }
      );
    }

    // Store in cache
    await admin.from("survey_translations_cache").insert({
      survey_id: surveyId,
      language: lang,
      translations,
    });

    return NextResponse.json(translations);
  } catch (e) {
    console.error("Translation error:", e);
    return NextResponse.json(
      { error: "Erreur lors de la traduction" },
      { status: 500 }
    );
  }
}
