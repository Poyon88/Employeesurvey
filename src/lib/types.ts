export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "likert"
  | "free_text";

export type SurveyStatus = "draft" | "published" | "closed";

export type Survey = {
  id: string;
  title_fr: string;
  title_en: string | null;
  description_fr: string | null;
  description_en: string | null;
  status: SurveyStatus;
  created_by: string;
  wave_group_id: string | null;
  wave_number: number;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type Question = {
  id: string;
  survey_id: string;
  type: QuestionType;
  text_fr: string;
  text_en: string | null;
  sort_order: number;
  required: boolean;
  created_at: string;
  question_options?: QuestionOption[];
};

export type QuestionOption = {
  id: string;
  question_id: string;
  text_fr: string;
  text_en: string | null;
  value: string | null;
  sort_order: number;
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Choix unique",
  multiple_choice: "Choix multiple",
  likert: "Échelle de Likert (1-10)",
  free_text: "Texte libre",
};
