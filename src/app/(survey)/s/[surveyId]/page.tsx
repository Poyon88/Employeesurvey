"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

type SurveyData = {
  id: string;
  title_fr: string;
  title_en: string | null;
  description_fr: string | null;
  description_en: string | null;
  status: string;
};

type QuestionData = {
  id: string;
  type: string;
  text_fr: string;
  text_en: string | null;
  required: boolean;
  sort_order: number;
  options: {
    id: string;
    text_fr: string;
    text_en: string | null;
    sort_order: number;
  }[];
};

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

  const supabase = createClient();

  const [token, setToken] = useState(tokenParam);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentStep, setCurrentStep] = useState(0); // 0 = welcome, 1..n = questions, n+1 = confirm
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalSteps = questions.length + 2; // welcome + questions + confirm

  const loadSurvey = useCallback(async () => {
    setLoading(true);

    const { data: surveyData, error: surveyError } = await supabase
      .from("surveys")
      .select("id, title_fr, title_en, description_fr, description_en, status")
      .eq("id", surveyId)
      .single();

    if (surveyError || !surveyData) {
      setError("Sondage introuvable");
      setLoading(false);
      return;
    }

    if (surveyData.status !== "published") {
      setError("Ce sondage n'est pas disponible");
      setLoading(false);
      return;
    }

    setSurvey(surveyData);

    const { data: questionsData } = await supabase
      .from("questions")
      .select("id, type, text_fr, text_en, required, sort_order, question_options(*)")
      .eq("survey_id", surveyId)
      .order("sort_order");

    if (questionsData) {
      setQuestions(
        questionsData.map((q) => ({
          ...q,
          options: ((q.question_options as QuestionData["options"]) || []).sort(
            (a, b) => a.sort_order - b.sort_order
          ),
        }))
      );
    }

    setLoading(false);
  }, [supabase, surveyId]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  // If token in URL, auto-validate
  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
      setTokenValidated(true);
    }
  }, [tokenParam]);

  function getText(fr: string, en: string | null): string {
    if (lang === "en" && en) return en;
    return fr;
  }

  function setAnswer(
    questionId: string,
    data: Partial<AnswerMap[string]>
  ) {
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
        return answer.numeric_value !== undefined;
      case "free_text":
        return !!answer.text_value?.trim();
      default:
        return false;
    }
  }

  function canProceed(): boolean {
    if (currentStep === 0) {
      return tokenValidated && !!token;
    }
    if (currentStep > 0 && currentStep <= questions.length) {
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
      .map((q) => ({
        question_id: q.id,
        ...answers[q.id],
      }));

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

  const progress = ((currentStep) / (totalSteps - 1)) * 100;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-sm font-medium">PulseSurvey</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          >
            <Globe className="mr-1 h-4 w-4" />
            {lang === "fr" ? "EN" : "FR"}
          </Button>
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

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Welcome step */}
          {currentStep === 0 && (
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">
                  {getText(survey.title_fr, survey.title_en)}
                </CardTitle>
                {(survey.description_fr || survey.description_en) && (
                  <CardDescription className="text-base">
                    {getText(
                      survey.description_fr || "",
                      survey.description_en
                    )}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {lang === "fr"
                    ? "Vos réponses sont totalement anonymes. Aucune information personnelle n'est collectée."
                    : "Your answers are completely anonymous. No personal information is collected."}
                </p>
                {!tokenValidated && (
                  <div className="space-y-2">
                    <Label>
                      {lang === "fr"
                        ? "Saisissez votre token d'accès"
                        : "Enter your access token"}
                    </Label>
                    <Input
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder={
                        lang === "fr"
                          ? "Collez votre token ici..."
                          : "Paste your token here..."
                      }
                      className="font-mono"
                    />
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (token.trim()) setTokenValidated(true);
                      }}
                      disabled={!token.trim()}
                    >
                      {lang === "fr" ? "Valider" : "Validate"}
                    </Button>
                  </div>
                )}
                {tokenValidated && (
                  <p className="text-center text-sm text-green-600">
                    {lang === "fr"
                      ? "Token validé. Cliquez sur Suivant pour commencer."
                      : "Token validated. Click Next to start."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Question steps */}
          {currentStep > 0 && currentStep <= questions.length && (
            <QuestionView
              question={questions[currentStep - 1]}
              answer={answers[questions[currentStep - 1].id] || {}}
              onAnswer={(data) =>
                setAnswer(questions[currentStep - 1].id, data)
              }
              lang={lang}
              getText={getText}
            />
          )}

          {/* Confirmation step */}
          {currentStep === questions.length + 1 && (
            <Card>
              <CardHeader className="text-center">
                <CardTitle>
                  {lang === "fr" ? "Confirmer l'envoi" : "Confirm submission"}
                </CardTitle>
                <CardDescription>
                  {lang === "fr"
                    ? `Vous avez répondu à ${questions.filter((q) => isQuestionAnswered(q)).length} question(s) sur ${questions.length}.`
                    : `You answered ${questions.filter((q) => isQuestionAnswered(q)).length} out of ${questions.length} question(s).`}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {lang === "fr"
                    ? "Une fois envoyées, vos réponses ne pourront pas être modifiées."
                    : "Once submitted, your answers cannot be changed."}
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
                      {lang === "fr" ? "Envoi..." : "Sending..."}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {lang === "fr"
                        ? "Envoyer mes réponses"
                        : "Submit my answers"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t bg-background px-4 py-4">
        <div className="mx-auto flex max-w-2xl justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {lang === "fr" ? "Précédent" : "Previous"}
          </Button>
          {currentStep < questions.length + 1 && (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
            >
              {lang === "fr" ? "Suivant" : "Next"}
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
  lang,
  getText,
}: {
  question: QuestionData;
  answer: AnswerMap[string];
  onAnswer: (data: Partial<AnswerMap[string]>) => void;
  lang: "fr" | "en";
  getText: (fr: string, en: string | null) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {getText(question.text_fr, question.text_en)}
          {question.required && <span className="text-destructive ml-1">*</span>}
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
                  {getText(opt.text_fr, opt.text_en)}
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
                    {getText(opt.text_fr, opt.text_en)}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {question.type === "likert" && (
          <div className="space-y-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {lang === "fr" ? "Pas du tout d'accord" : "Strongly disagree"}
              </span>
              <span>
                {lang === "fr" ? "Tout à fait d'accord" : "Strongly agree"}
              </span>
            </div>
            <div className="flex justify-between gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onAnswer({ numeric_value: val })}
                  className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
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
                {lang === "fr" ? "Votre choix :" : "Your choice:"}{" "}
                <strong>{answer.numeric_value}/10</strong>
              </p>
            )}
          </div>
        )}

        {question.type === "free_text" && (
          <Textarea
            value={answer.text_value || ""}
            onChange={(e) => onAnswer({ text_value: e.target.value })}
            placeholder={
              lang === "fr"
                ? "Saisissez votre réponse..."
                : "Enter your answer..."
            }
            rows={4}
          />
        )}
      </CardContent>
    </Card>
  );
}
