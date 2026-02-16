"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Upload,
  Loader2,
  Check,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { QuestionType } from "@/lib/types";
import { QUESTION_TYPE_LABELS } from "@/lib/types";

type ParsedQuestion = {
  text_fr: string;
  text_en: string;
  type: QuestionType;
  options: { text_fr: string; text_en: string }[];
  selected: boolean;
};

export default function ImportPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [documentTitle, setDocumentTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [surveyStatus, setSurveyStatus] = useState<string | null>(null);

  const loadSurveyStatus = useCallback(async () => {
    const { data } = await supabase
      .from("surveys")
      .select("status")
      .eq("id", surveyId)
      .single();
    if (data) setSurveyStatus(data.status);
  }, [supabase, surveyId]);

  useEffect(() => {
    loadSurveyStatus();
  }, [loadSurveyStatus]);

  async function handleParse() {
    if (!file) return;

    setParsing(true);
    setQuestions([]);
    setDocumentTitle("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/parse-document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Erreur d'analyse", { description: data.error });
        setParsing(false);
        return;
      }

      if (data.documentTitle) setDocumentTitle(data.documentTitle);

      setQuestions(
        data.questions.map((q: ParsedQuestion) => ({
          ...q,
          selected: true,
        }))
      );

      toast.success(`${data.questions.length} question(s) extraite(s)`);
    } catch {
      toast.error("Erreur lors de l'envoi du fichier");
    }

    setParsing(false);
  }

  function toggleQuestion(index: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index ? { ...q, selected: !q.selected } : q
      )
    );
  }

  function updateQuestionType(index: number, type: QuestionType) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, type } : q))
    );
  }

  function toggleSelectAll() {
    const allSelected = questions.every((q) => q.selected);
    setQuestions((prev) => prev.map((q) => ({ ...q, selected: !allSelected })));
  }

  async function handleImport() {
    const selectedQuestions = questions.filter((q) => q.selected);
    if (selectedQuestions.length === 0) {
      toast.error("Sélectionnez au moins une question");
      return;
    }

    setImporting(true);

    // Get existing questions count for sort_order
    const { data: existingQuestions } = await supabase
      .from("questions")
      .select("id")
      .eq("survey_id", surveyId);

    const startOrder = existingQuestions?.length || 0;

    for (let i = 0; i < selectedQuestions.length; i++) {
      const q = selectedQuestions[i];

      const { data: insertedQ, error: qError } = await supabase
        .from("questions")
        .insert({
          survey_id: surveyId,
          type: q.type,
          text_fr: q.text_fr,
          text_en: q.text_en || null,
          sort_order: startOrder + i,
          required: true,
        })
        .select("id")
        .single();

      if (qError || !insertedQ) {
        toast.error(`Erreur question ${i + 1}`, {
          description: qError?.message,
        });
        setImporting(false);
        return;
      }

      // Insert options for choice-type questions
      if (
        (q.type === "single_choice" || q.type === "multiple_choice") &&
        q.options.length > 0
      ) {
        const optionsToInsert = q.options
          .filter((o) => o.text_fr.trim())
          .map((o, j) => ({
            question_id: insertedQ.id,
            text_fr: o.text_fr,
            text_en: o.text_en || null,
            sort_order: j,
          }));

        if (optionsToInsert.length > 0) {
          const { error: oError } = await supabase
            .from("question_options")
            .insert(optionsToInsert);

          if (oError) {
            toast.error(`Erreur options question ${i + 1}`, {
              description: oError.message,
            });
            setImporting(false);
            return;
          }
        }
      }
    }

    toast.success(
      `${selectedQuestions.length} question(s) importée(s) dans le sondage`
    );
    router.push(`/surveys/${surveyId}/edit`);
  }

  if (surveyStatus !== null && surveyStatus !== "draft") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/surveys/${surveyId}/edit`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Import IA</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            L&apos;import IA n&apos;est disponible que pour les sondages en
            brouillon.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/surveys/${surveyId}/edit`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Import IA de questionnaire</h1>
          <p className="text-sm text-muted-foreground">
            Importez un document PDF, Word ou texte pour extraire
            automatiquement les questions
          </p>
        </div>
      </div>

      {/* Upload section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Extraction intelligente
          </CardTitle>
          <CardDescription>
            Uploadez un questionnaire existant (PDF, .docx ou .txt). Claude
            analysera le document et extraira les questions automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Document source</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              <Button
                onClick={handleParse}
                disabled={!file || parsing}
              >
                {parsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyse...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Analyser
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formats acceptés : PDF, Word (.docx), Texte (.txt) — max 50 000
              caractères
            </p>
          </div>

          {parsing && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Analyse en cours...</p>
                <p className="text-sm text-muted-foreground">
                  Claude lit et structure le questionnaire. Cela peut prendre
                  quelques secondes.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {questions.length > 0 && (
        <>
          {documentTitle && (
            <Card>
              <CardContent className="flex items-center gap-2 py-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Document : <strong>{documentTitle}</strong>
                </span>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Questions extraites ({questions.filter((q) => q.selected).length}
                /{questions.length} sélectionnées)
              </h2>
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {questions.every((q) => q.selected)
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </Button>
            </div>

            {questions.map((q, i) => (
              <Card
                key={i}
                className={
                  q.selected ? "" : "opacity-50"
                }
              >
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleQuestion(i)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        q.selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground"
                      }`}
                    >
                      {q.selected && <Check className="h-3 w-3" />}
                    </button>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Q{i + 1}
                        </Badge>
                        <Select
                          value={q.type}
                          onValueChange={(v) =>
                            updateQuestionType(i, v as QuestionType)
                          }
                        >
                          <SelectTrigger className="h-7 w-auto text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(QUESTION_TYPE_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="font-medium">{q.text_fr}</p>
                      {q.text_en && (
                        <p className="text-sm text-muted-foreground">
                          {q.text_en}
                        </p>
                      )}
                      {q.options.length > 0 &&
                        (q.type === "single_choice" ||
                          q.type === "multiple_choice") && (
                          <div className="space-y-1 pl-4">
                            {q.options.map((opt, j) => (
                              <div
                                key={j}
                                className="flex items-center gap-2 text-sm"
                              >
                                <span className="text-muted-foreground">
                                  {j + 1}.
                                </span>
                                <span>{opt.text_fr}</span>
                                {opt.text_en && (
                                  <span className="text-muted-foreground">
                                    / {opt.text_en}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-end gap-2">
              <Link href={`/surveys/${surveyId}/edit`}>
                <Button variant="outline">
                  <X className="mr-2 h-4 w-4" />
                  Annuler
                </Button>
              </Link>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Import...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Importer {questions.filter((q) => q.selected).length}{" "}
                    question(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
