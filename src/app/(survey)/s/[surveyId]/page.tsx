"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  Globe,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { AVAILABLE_LANGUAGES, getUIString } from "@/lib/utils/languages";

type SurveyData = {
  id: string;
  title_fr: string;
  description_fr: string | null;
  introduction_fr: string | null;
  status: string;
};

type SectionData = {
  id: string;
  title_fr: string;
  sort_order: number;
};

type QuestionData = {
  id: string;
  type: string;
  text_fr: string;
  required: boolean;
  sort_order: number;
  section_id: string | null;
  options: {
    id: string;
    text_fr: string;
    sort_order: number;
  }[];
};

type TranslationData = {
  survey: { title: string; description: string; introduction: string };
  sections: Record<string, { title: string }>;
  questions: Record<string, { text: string }>;
  options: Record<string, { text: string }>;
} | null;

type AnswerMap = Record<
  string,
  {
    numeric_value?: number;
    text_value?: string;
    selected_option_ids?: string[];
  }
>;

export default function SurveyRespondentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const surveyId = params.surveyId as string;
  const tokenParam = searchParams.get("t") || "";
  const isPreview = searchParams.get("preview") === "1";

  const [token, setToken] = useState(tokenParam);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [validatingToken, setValidatingToken] = useState(false);
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [surveySections, setSurveySections] = useState<SectionData[]>([]);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [lang, setLang] = useState("fr");
  const [translations, setTranslations] = useState<TranslationData>(null);
  const [translating, setTranslating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalSteps = questions.length + 2;
  const ui = (key: string, replacements?: Record<string, string | number>) =>
    getUIString(lang, key, replacements);

  const loadSurvey = useCallback(async () => {
    setLoading(true);

    try {
      const previewParam = isPreview ? "&preview=1" : "";
      const res = await fetch(`/api/surveys/${surveyId}/public?${previewParam}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Sondage introuvable");
        setLoading(false);
        return;
      }

      setSurvey(data.survey);
      setSurveySections(data.sections || []);
      setQuestions(data.questions || []);
    } catch {
      setError("Erreur réseau");
    }

    setLoading(false);
  }, [surveyId, isPreview]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  async function validateToken(t: string) {
    if (!t.trim()) return;
    setValidatingToken(true);
    try {
      const res = await fetch(`/api/surveys/${surveyId}/validate-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setTokenValidated(true);
      } else {
        toast.error("Token invalide");
        setTokenValidated(false);
      }
    } catch {
      toast.error("Erreur réseau");
      setTokenValidated(false);
    }
    setValidatingToken(false);
  }

  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
      validateToken(tokenParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenParam]);

  // Load translations when language changes
  useEffect(() => {
    if (lang === "fr") {
      setTranslations(null);
      return;
    }

    let cancelled = false;

    async function loadTranslations() {
      setTranslating(true);
      try {
        const res = await fetch(
          `/api/surveys/${surveyId}/translate?lang=${lang}`
        );
        if (!res.ok) {
          toast.error("Erreur de traduction");
          if (!cancelled) {
            setLang("fr");
            setTranslations(null);
          }
        } else {
          const data = await res.json();
          if (!cancelled) setTranslations(data);
        }
      } catch {
        if (!cancelled) {
          toast.error("Erreur réseau");
          setLang("fr");
          setTranslations(null);
        }
      }
      if (!cancelled) setTranslating(false);
    }

    loadTranslations();
    return () => {
      cancelled = true;
    };
  }, [lang, surveyId]);

  // Translation helpers
  function getSurveyText(field: "title" | "description" | "introduction"): string {
    if (lang !== "fr" && translations?.survey) {
      const t = translations.survey[field];
      if (t) return t;
    }
    if (field === "title") return survey?.title_fr || "";
    if (field === "description") return survey?.description_fr || "";
    return survey?.introduction_fr || "";
  }

  function getSectionTitle(sectionId: string): string {
    const sec = surveySections.find((s) => s.id === sectionId);
    if (!sec) return "";
    if (lang !== "fr" && translations?.sections?.[sectionId]?.title) {
      return translations.sections[sectionId].title;
    }
    return sec.title_fr;
  }

  function getQuestionSectionId(questionIndex: number): string | null {
    const question = questions[questionIndex];
    if (!question?.section_id) return null;
    // Show section title only on the first question of each section
    if (questionIndex === 0) return question.section_id;
    const prevQuestion = questions[questionIndex - 1];
    if (prevQuestion?.section_id !== question.section_id) return question.section_id;
    return null;
  }

  function getQuestionText(questionId: string, frText: string): string {
    if (lang !== "fr" && translations?.questions?.[questionId]?.text) {
      return translations.questions[questionId].text;
    }
    return frText;
  }

  function getOptionText(optionId: string, frText: string): string {
    if (lang !== "fr" && translations?.options?.[optionId]?.text) {
      return translations.options[optionId].text;
    }
    return frText;
  }

  function setAnswer(questionId: string, data: Partial<AnswerMap[string]>) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...data },
    }));
  }

  function isQuestionAnswered(question: QuestionData): boolean {
    const answer = answers[question.id];
    if (!answer) return false;
    switch (question.type) {
      case "single_choice":
        return (answer.selected_option_ids?.length ?? 0) > 0;
      case "multiple_choice":
        return (answer.selected_option_ids?.length ?? 0) > 0;
      case "likert":
      case "likert_5":
        return answer.numeric_value !== undefined;
      case "free_text":
        return !!answer.text_value?.trim();
      default:
        return false;
    }
  }

  function canProceed(): boolean {
    if (currentStep === 0) return isPreview || (tokenValidated && !!token);
    if (currentStep > 0 && currentStep <= questions.length) {
      if (isPreview) return true;
      const question = questions[currentStep - 1];
      if (question.required) return isQuestionAnswered(question);
      return true;
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    const answersList = questions
      .filter((q) => answers[q.id])
      .map((q) => ({ question_id: q.id, ...answers[q.id] }));

    try {
      const res = await fetch(`/api/surveys/${surveyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers: answersList }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la soumission");
        setSubmitting(false);
        return;
      }
      router.push("/thank-you");
    } catch {
      toast.error("Erreur réseau");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <p className="text-lg font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!survey) return null;

  const progress = (currentStep / (totalSteps - 1)) * 100;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Preview banner */}
      {isPreview && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
          <Eye className="mr-2 inline h-4 w-4" />
          Mode prévisualisation — Les réponses ne seront pas enregistrées
        </div>
      )}

      {/* Top bar */}
      <div className="border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-sm font-medium">PulseSurvey</span>
          <Select value={lang} onValueChange={(v) => setLang(v)}>
            <SelectTrigger className="w-auto h-8 gap-2">
              <Globe className="h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.flag} {l.nativeLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pt-4">
        <div className="mx-auto max-w-2xl">
          <Progress value={progress} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground text-right">
            {currentStep}/{totalSteps - 1}
          </p>
        </div>
      </div>

      {/* Translation loading overlay */}
      {translating && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-6 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">{ui("translating")}</span>
          </div>
        </div>
      )}

      {/* Content */}
      {!translating && (
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl">
            {/* Welcome step */}
            {currentStep === 0 && (
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">
                    {getSurveyText("title")}
                  </CardTitle>
                  {getSurveyText("description") && (
                    <CardDescription className="text-base">
                      {getSurveyText("description")}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {getSurveyText("introduction") && (
                    <div className="rounded-lg border bg-muted/50 p-4 text-sm whitespace-pre-line">
                      {getSurveyText("introduction")}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground text-center">
                    {ui("anonymous_notice")}
                  </p>
                  {!isPreview && !tokenValidated && (
                    <div className="space-y-2">
                      <Label>{ui("enter_token")}</Label>
                      <Input
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder={ui("paste_token")}
                        className="font-mono"
                      />
                      <Button
                        className="w-full"
                        onClick={() => validateToken(token)}
                        disabled={!token.trim() || validatingToken}
                      >
                        {validatingToken ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {ui("validate")}
                          </>
                        ) : (
                          ui("validate")
                        )}
                      </Button>
                    </div>
                  )}
                  {!isPreview && tokenValidated && (
                    <p className="text-center text-sm text-green-600">
                      {ui("token_validated")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Question steps */}
            {currentStep > 0 && currentStep <= questions.length && (() => {
              const questionIndex = currentStep - 1;
              const sectionId = getQuestionSectionId(questionIndex);
              return (
                <div className="space-y-4">
                  {sectionId && (
                    <div className="rounded-lg border bg-muted/50 px-4 py-3">
                      <p className="font-semibold text-sm text-muted-foreground">
                        {getSectionTitle(sectionId)}
                      </p>
                    </div>
                  )}
                  <QuestionView
                    question={questions[questionIndex]}
                    answer={answers[questions[questionIndex].id] || {}}
                    onAnswer={(data) =>
                      setAnswer(questions[questionIndex].id, data)
                    }
                    getQuestionText={getQuestionText}
                    getOptionText={getOptionText}
                    ui={ui}
                  />
                </div>
              );
            })()}

            {/* Confirmation step */}
            {currentStep === questions.length + 1 && (
              <Card>
                <CardHeader className="text-center">
                  <CardTitle>{ui("confirm_title")}</CardTitle>
                  <CardDescription>
                    {ui("answered_count", {
                      answered: questions.filter((q) => isQuestionAnswered(q))
                        .length,
                      total: questions.length,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  {isPreview ? (
                    <p className="text-sm text-amber-600 font-medium">
                      Mode prévisualisation — La soumission est désactivée.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">
                        {ui("confirm_warning")}
                      </p>
                      <Button
                        size="lg"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full sm:w-auto"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {ui("sending")}
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            {ui("submit")}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="border-t bg-background px-4 py-4">
        <div className="mx-auto flex max-w-2xl justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0 || translating}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {ui("previous")}
          </Button>
          {currentStep < questions.length + 1 && (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed() || translating}
            >
              {ui("next")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionView({
  question,
  answer,
  onAnswer,
  getQuestionText,
  getOptionText,
  ui,
}: {
  question: QuestionData;
  answer: AnswerMap[string];
  onAnswer: (data: Partial<AnswerMap[string]>) => void;
  getQuestionText: (id: string, fr: string) => string;
  getOptionText: (id: string, fr: string) => string;
  ui: (key: string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {getQuestionText(question.id, question.text_fr)}
          {question.required && (
            <span className="text-destructive ml-1">*</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {question.type === "single_choice" && (
          <RadioGroup
            value={answer.selected_option_ids?.[0] || ""}
            onValueChange={(val) =>
              onAnswer({ selected_option_ids: [val] })
            }
            className="space-y-3"
          >
            {question.options.map((opt) => (
              <div key={opt.id} className="flex items-center space-x-3">
                <RadioGroupItem value={opt.id} id={opt.id} />
                <Label htmlFor={opt.id} className="cursor-pointer font-normal">
                  {getOptionText(opt.id, opt.text_fr)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {question.type === "multiple_choice" && (
          <div className="space-y-3">
            {question.options.map((opt) => {
              const selected =
                answer.selected_option_ids?.includes(opt.id) || false;
              return (
                <div key={opt.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={opt.id}
                    checked={selected}
                    onCheckedChange={(checked) => {
                      const current = answer.selected_option_ids || [];
                      const updated = checked
                        ? [...current, opt.id]
                        : current.filter((id) => id !== opt.id);
                      onAnswer({ selected_option_ids: updated });
                    }}
                  />
                  <Label
                    htmlFor={opt.id}
                    className="cursor-pointer font-normal"
                  >
                    {getOptionText(opt.id, opt.text_fr)}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {question.type === "likert" && (
          <div className="space-y-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{ui("strongly_disagree")}</span>
              <span>{ui("strongly_agree")}</span>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 sm:gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onAnswer({ numeric_value: val })}
                  className={`flex h-11 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                    answer.numeric_value === val
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            {answer.numeric_value && (
              <p className="text-center text-sm text-muted-foreground">
                {ui("your_choice")} <strong>{answer.numeric_value}/10</strong>
              </p>
            )}
          </div>
        )}

        {question.type === "likert_5" && (
          <div className="space-y-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{ui("strongly_disagree")}</span>
              <span>{ui("strongly_agree")}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }, (_, i) => i + 1).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onAnswer({ numeric_value: val })}
                  className={`flex h-12 items-center justify-center rounded-md border text-base font-medium transition-colors ${
                    answer.numeric_value === val
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            {answer.numeric_value && (
              <p className="text-center text-sm text-muted-foreground">
                {ui("your_choice")} <strong>{answer.numeric_value}/5</strong>
              </p>
            )}
          </div>
        )}

        {question.type === "free_text" && (
          <Textarea
            value={answer.text_value || ""}
            onChange={(e) => onAnswer({ text_value: e.target.value })}
            placeholder={ui("enter_answer")}
            rows={4}
          />
        )}
      </CardContent>
    </Card>
  );
}
