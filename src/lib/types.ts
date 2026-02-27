export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "likert"
  | "likert_5"
  | "free_text";

export type SurveyStatus = "draft" | "published" | "closed";

export type SurveyType = "classique" | "pulse";

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
  closes_at: string | null;
  closed_at: string | null;
  created_at: string;
  survey_type: SurveyType;
  sample_percentage: number | null;
  filters: SurveyFilters;
};

export type SurveyFilters = {
  societe_ids?: string[];
  direction_ids?: string[];
  department_ids?: string[];
  service_ids?: string[];
  sexe?: string[];
  fonctions?: string[];
  lieux_travail?: string[];
  types_contrat?: string[];
  temps_travail?: string[];
  cost_centers?: string[];
  age_min?: number;
  age_max?: number;
  seniority_min?: number;
  seniority_max?: number;
};

export type SurveyToken = {
  id: string;
  survey_id: string;
  token_id: string;
  selected_by: "filter" | "sample";
  invitation_sent_at: string | null;
  teams_invitation_sent_at: string | null;
  reminder_sent_at: string | null;
  teams_reminder_sent_at: string | null;
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
  likert_5: "Échelle de Likert (1-5)",
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
  sexe: string | null;
  date_naissance: string | null;
  date_entree: string | null;
  fonction: string | null;
  lieu_travail: string | null;
  type_contrat: string | null;
  temps_travail: string | null;
  cost_center: string | null;
};

export type EmailSendResult = {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  message?: string;
  errors: Array<{ email: string; error: string }>;
};
