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
  introduction_fr: string | null;
  introduction_en: string | null;
  status: SurveyStatus;
  created_by: string;
  societe_id: string | null;
  wave_group_id: string | null;
  wave_number: number;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type SurveySection = {
  id: string;
  survey_id: string;
  title_fr: string;
  sort_order: number;
  created_at: string;
};

export type Question = {
  id: string;
  survey_id: string;
  section_id: string | null;
  type: QuestionType;
  text_fr: string;
  text_en: string | null;
  question_code: string | null;
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

export type AnonymousToken = {
  id: string;
  token: string;
  email: string | null;
  employee_name: string | null;
  societe_id: string | null;
  direction_id: string | null;
  department_id: string | null;
  service_id: string | null;
  invitation_sent_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
};

export type EmailSendResult = {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  message?: string;
  errors: Array<{ email: string; error: string }>;
};
