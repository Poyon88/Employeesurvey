import Anthropic from "@anthropic-ai/sdk";
import type { ParsedQuestion, ParseResult } from "./parse-questionnaire";

export type GenerateSurveyInput = {
  prompt: string;
  template?: string;
  questionCount?: number;
  allowedTypes?: string[];
};

const TEMPLATES: Record<string, string> = {
  satisfaction:
    "Enquete de satisfaction des employes couvrant : conditions de travail, remuneration, equilibre vie pro/perso, relations avec les collegues, environnement physique.",
  engagement:
    "Enquete d'engagement couvrant : motivation, sentiment d'appartenance, fierte, recommandation de l'entreprise, perspectives d'evolution.",
  qvt:
    "Enquete Qualite de Vie au Travail (QVT) couvrant : charge de travail, stress, sante, securite, ambiance, reconnaissance, autonomie.",
  onboarding:
    "Enquete d'integration des nouveaux collaborateurs couvrant : accueil, formation initiale, accompagnement, outils, comprehension du poste.",
  management:
    "Evaluation du management couvrant : communication, ecoute, feedback, delegation, soutien, gestion des conflits, leadership.",
  "360":
    "Feedback 360 degres couvrant : competences professionnelles, leadership, communication, collaboration, innovation, resultats.",
  depart:
    "Enquete de depart couvrant : raisons du depart, satisfaction globale, points d'amelioration, recommandation, experience vecue.",
};

const SYSTEM_PROMPT = `Tu es un expert en conception de sondages employes / RH, forme aux methodologies scientifiques et aux echelles psychometriques validees.
Tu generes des questionnaires professionnels, structures et pertinents.

=== BASE DE CONNAISSANCES SCIENTIFIQUE ===

PHASE 1 - STRATEGIE ET CONTEXTE :
- Adopte une approche centree sur le probleme : identifie le probleme metier que le sondage vise a resoudre.
- Identifie l'audience cible et segmente si necessaire (managers, collaborateurs, nouveaux arrivants...).
- Prends en compte le parcours employe (talent acquisition -> onboarding -> developpement -> offboarding) pour cibler les bons moments.

PHASE 2 - FORMAT ET LONGUEUR (prevention de la fatigue) :
- Pulse survey : 3 a 5 questions maximum, frequents et agiles.
- Sondage cible/lifecycle (onboarding, changement, conge parental) : 5 a 10 questions.
- Sondage annuel : plus long, pour le benchmarking et le suivi longitudinal.
- Adapte la longueur au format demande. Vise un taux de completion >70%.

PHASE 3 - REGLES DE CONCEPTION DES QUESTIONS :
- Clarte et simplicite : langage accessible, pas de jargon RH ou technique.
- Regle du concept unique : exactement UNE idee par question. Interdiction formelle des questions "double-barreled" (ex: "Mon manager me donne du feedback ET soutient mon developpement").
- Actionnabilite : chaque question doit pouvoir mener a une action concrete. Eviter les constructions vagues ("Etes-vous heureux ?").
- Neutralite : questions non-orientees, pas de formulations suggestives (ex: eviter "Ne pensez-vous pas que notre nouveau programme est excellent ?").

PHASE 4 - ECHELLES PSYCHOMETRIQUES VALIDEES :
- Engagement : s'inspirer de l'Utrecht Work Engagement Scale (UWES) mesurant vigueur, dedication, absorption. Echelle de frequence 0-6 (jamais -> toujours).
- Engagement specifique : Job Engagement Scale (JES) pour distinguer engagement cognitif, emotionnel et physique.
- Securite psychologique : s'inspirer de l'echelle d'Amy Edmondson (7 items) et des 4 etapes de Timothy Clark (Inclusion, Apprentissage, Contribution, Challenge). Echelle 1-5 avec items inverses (ex: "Si vous faites une erreur dans cette equipe, elle est souvent retenue contre vous").
- NPS employe : echelle 0-10 pour la recommandation.

PHASE 5 - ECHELLES DE REPONSE ET PREVENTION DES BIAIS :
- Echelles quantitatives coherentes : 1-5 satisfaction ou 0-10 NPS avec labels clairs a chaque point.
- Pour le feedback 360 : privilegier les comportements concrets et observables plutot que les traits abstraits.
- Inclure des items inverses pour detecter les reponses automatiques.
- Varier les types de questions pour maintenir l'attention.

PHASE 6 - FRAMEWORK D'ITERATION (SHRM) :
- S (Specify) : definir clairement l'objectif et le contexte.
- H (Hypothesize) : anticiper comment les repondants interpreteront les questions.
- R (Refine) : iterer sur la formulation, appliquer les contraintes (ton, longueur), eliminer le jargon.
- M (Measure) : definir les criteres de succes (precision, brievete, taux de completion).

PHILOSOPHIE : Le succes d'un sondage ne se mesure pas par la quantite de donnees collectees, mais par le changement positif et actionnable qu'il genere dans l'organisation.

=== REGLES DE GENERATION ===

- Genere un questionnaire complet avec titre, description, introduction, sections et questions.
- Chaque question doit avoir un type parmi : "single_choice", "multiple_choice", "likert", "likert_5", "free_text"
- Utilise "likert_5" par defaut pour les echelles de satisfaction/accord (1-5 : Pas du tout d'accord -> Tout a fait d'accord)
- Utilise "likert" (1-10) uniquement si explicitement demande ou pour des echelles de type NPS/UWES
- Pour les questions a choix, fournis des options pertinentes et equilibrees
- Genere un code court unique par question (prefixe thematique + numero, ex: SAT-01, MGT-03, PSY-02)
- Regroupe les questions en sections thematiques coherentes
- Formule les questions en francais professionnel
- Termine par 1-2 questions ouvertes (free_text) pour recueillir des commentaires
- Inclus au moins un item inverse si le sondage contient plus de 10 questions
- Adapte le nombre de questions au format (pulse: 3-5, cible: 5-10, complet: 15-30)

Retourne UNIQUEMENT un JSON valide (pas de markdown, pas de texte autour) :
{
  "title": "Titre du sondage",
  "description": "Description courte du sondage (2-3 phrases)",
  "introduction": "Texte d'introduction affiche aux repondants avant le questionnaire (3-5 phrases, ton bienveillant, rappelant l'anonymat et l'importance de la sincerite)",
  "sections": [
    {
      "name": "Nom de la section",
      "questions": [
        {
          "text_fr": "Texte de la question",
          "text_en": "",
          "type": "likert_5",
          "question_code": "SAT-01",
          "section": "Nom de la section",
          "options": []
        }
      ]
    }
  ]
}

Pour les types likert/likert_5, ne fournis PAS d'options (tableau vide).
Pour single_choice et multiple_choice, fournis les options avec text_fr et text_en.`;

export type GeneratedSurvey = {
  title: string;
  description: string;
  introduction: string;
  sections: {
    name: string;
    questions: ParsedQuestion[];
  }[];
};

export async function generateSurvey(
  input: GenerateSurveyInput
): Promise<GeneratedSurvey> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    throw new Error("ANTHROPIC_API_KEY non configuree");
  }

  const client = new Anthropic({ apiKey });

  // Build user prompt
  let userPrompt = input.prompt;

  if (input.template && TEMPLATES[input.template]) {
    userPrompt = `${TEMPLATES[input.template]}\n\nInstructions supplementaires de l'utilisateur : ${input.prompt}`;
  }

  if (input.questionCount) {
    userPrompt += `\n\nGenere exactement ${input.questionCount} questions.`;
  }

  if (input.allowedTypes && input.allowedTypes.length > 0) {
    userPrompt += `\n\nUtilise uniquement ces types de questions : ${input.allowedTypes.join(", ")}.`;
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonStr) as GeneratedSurvey;

  if (!parsed.sections || !Array.isArray(parsed.sections)) {
    throw new Error("Format de reponse IA invalide");
  }

  // Normalize
  parsed.title = parsed.title || "Sondage genere par IA";
  parsed.description = parsed.description || "";
  parsed.introduction = parsed.introduction || "";
  parsed.sections = parsed.sections.map((s) => ({
    name: s.name || "Section",
    questions: (s.questions || []).map((q) => ({
      text_fr: q.text_fr || "",
      text_en: q.text_en || "",
      type: ["single_choice", "multiple_choice", "likert", "likert_5", "free_text"].includes(q.type)
        ? q.type
        : "free_text",
      question_code: q.question_code || "",
      section: s.name || "",
      options: Array.isArray(q.options)
        ? q.options.map((o) => ({ text_fr: o.text_fr || "", text_en: o.text_en || "" }))
        : [],
    })),
  }));

  return parsed;
}

export function getTemplateList() {
  return [
    { id: "satisfaction", label: "Satisfaction des employes" },
    { id: "engagement", label: "Engagement" },
    { id: "qvt", label: "Qualite de Vie au Travail (QVT)" },
    { id: "onboarding", label: "Integration / Onboarding" },
    { id: "management", label: "Evaluation du management" },
    { id: "360", label: "Feedback 360" },
    { id: "depart", label: "Enquete de depart" },
  ];
}
