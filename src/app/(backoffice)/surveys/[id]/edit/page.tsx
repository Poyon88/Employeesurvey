"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Plus,
  Save,
  Send,
  ArrowLeft,
  FileUp,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Survey, Question, QuestionOption } from "@/lib/types";
import {
  QuestionCard,
  type EditableQuestion,
} from "@/components/survey-editor/question-card";

export default function SurveyEditPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [titleFr, setTitleFr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descFr, setDescFr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [waveGroupId, setWaveGroupId] = useState<string>("");
  const [waveNumber, setWaveNumber] = useState<number>(1);
  const [waveGroups, setWaveGroups] = useState<{ id: string; name: string }[]>([]);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadSurvey = useCallback(async () => {
    setLoading(true);

    const { data: surveyData, error: surveyError } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", surveyId)
      .single();

    if (surveyError || !surveyData) {
      toast.error("Sondage introuvable");
      router.push("/surveys");
      return;
    }

    setSurvey(surveyData);
    setTitleFr(surveyData.title_fr);
    setTitleEn(surveyData.title_en || "");
    setDescFr(surveyData.description_fr || "");
    setDescEn(surveyData.description_en || "");
    setWaveGroupId(surveyData.wave_group_id || "");
    setWaveNumber(surveyData.wave_number || 1);

    // Load wave groups
    const { data: wgData } = await supabase
      .from("wave_groups")
      .select("id, name")
      .order("name");
    setWaveGroups(wgData || []);

    const { data: questionsData } = await supabase
      .from("questions")
      .select("*, question_options(*)")
      .eq("survey_id", surveyId)
      .order("sort_order");

    if (questionsData) {
      setQuestions(
        questionsData.map((q: Question & { question_options: QuestionOption[] }) => ({
          id: q.id,
          type: q.type,
          text_fr: q.text_fr,
          text_en: q.text_en || "",
          required: q.required,
          options: (q.question_options || [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((o) => ({
              id: o.id,
              text_fr: o.text_fr,
              text_en: o.text_en || "",
            })),
        }))
      );
    }

    setLoading(false);
  }, [supabase, surveyId, router]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        id: crypto.randomUUID(),
        type: "single_choice",
        text_fr: "",
        text_en: "",
        required: true,
        options: [
          { id: crypto.randomUUID(), text_fr: "", text_en: "" },
          { id: crypto.randomUUID(), text_fr: "", text_en: "" },
        ],
      },
    ]);
  }

  function updateQuestion(index: number, updated: EditableQuestion) {
    const newQuestions = [...questions];
    newQuestions[index] = updated;
    setQuestions(newQuestions);
  }

  function deleteQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    setQuestions(arrayMove(questions, oldIndex, newIndex));
  }

  async function handleSave() {
    setSaving(true);

    // Update survey metadata
    const { error: surveyError } = await supabase
      .from("surveys")
      .update({
        title_fr: titleFr,
        title_en: titleEn || null,
        description_fr: descFr || null,
        description_en: descEn || null,
        wave_group_id: waveGroupId || null,
        wave_number: waveNumber,
      })
      .eq("id", surveyId);

    if (surveyError) {
      toast.error("Erreur lors de la sauvegarde", {
        description: surveyError.message,
      });
      setSaving(false);
      return;
    }

    // Delete all existing questions (cascade deletes options)
    await supabase.from("questions").delete().eq("survey_id", surveyId);

    // Insert questions and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text_fr.trim()) continue;

      const { data: insertedQ, error: qError } = await supabase
        .from("questions")
        .insert({
          survey_id: surveyId,
          type: q.type,
          text_fr: q.text_fr,
          text_en: q.text_en || null,
          sort_order: i,
          required: q.required,
        })
        .select("id")
        .single();

      if (qError || !insertedQ) {
        toast.error(`Erreur question ${i + 1}`, { description: qError?.message });
        setSaving(false);
        return;
      }

      // Insert options if applicable
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
            setSaving(false);
            return;
          }
        }
      }
    }

    toast.success("Sondage sauvegardé");
    // Reload to get fresh IDs
    loadSurvey();
    setSaving(false);
  }

  async function handlePublish() {
    if (questions.length === 0) {
      toast.error("Ajoutez au moins une question avant de publier");
      return;
    }

    const emptyQuestions = questions.filter((q) => !q.text_fr.trim());
    if (emptyQuestions.length > 0) {
      toast.error("Certaines questions n'ont pas de texte");
      return;
    }

    if (!confirm("Publier ce sondage ? Il ne pourra plus être modifié.")) return;

    setPublishing(true);

    // Save first
    await handleSave();

    // Then publish
    const { error } = await supabase
      .from("surveys")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", surveyId);

    if (error) {
      toast.error("Erreur lors de la publication", { description: error.message });
    } else {
      toast.success("Sondage publié !");
      router.push(`/surveys/${surveyId}/distribute`);
    }
    setPublishing(false);
  }

  const isDraft = survey?.status === "draft";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/surveys">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {isDraft ? "Éditer le sondage" : "Voir le sondage"}
            </h1>
            <Badge variant={isDraft ? "secondary" : "default"}>
              {isDraft ? "Brouillon" : survey?.status === "published" ? "Publié" : "Clôturé"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Link href={`/surveys/${surveyId}/import`}>
                <Button variant="outline">
                  <FileUp className="mr-2 h-4 w-4" />
                  Import IA
                </Button>
              </Link>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
              <Button onClick={handlePublish} disabled={publishing || saving}>
                <Send className="mr-2 h-4 w-4" />
                {publishing ? "Publication..." : "Publier"}
              </Button>
            </>
          )}
          {survey?.status === "published" && (
            <>
              {survey.wave_group_id && (
                <Link href={`/surveys/${surveyId}/waves`}>
                  <Button variant="outline">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Vagues
                  </Button>
                </Link>
              )}
              <Link href={`/surveys/${surveyId}/distribute`}>
                <Button>
                  <Send className="mr-2 h-4 w-4" />
                  Distribuer
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Survey metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Titre et description du sondage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Titre (FR) *</Label>
              <Input
                value={titleFr}
                onChange={(e) => setTitleFr(e.target.value)}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>Titre (EN)</Label>
              <Input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                disabled={!isDraft}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Description (FR)</Label>
              <Textarea
                value={descFr}
                onChange={(e) => setDescFr(e.target.value)}
                rows={2}
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (EN)</Label>
              <Textarea
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                rows={2}
                disabled={!isDraft}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Groupe de vagues (suivi longitudinal)</Label>
              <Select
                value={waveGroupId || "none"}
                onValueChange={(v) => setWaveGroupId(v === "none" ? "" : v)}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {waveGroups.map((wg) => (
                    <SelectItem key={wg.id} value={wg.id}>
                      {wg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {waveGroupId && (
              <div className="space-y-2">
                <Label>Numéro de vague</Label>
                <Input
                  type="number"
                  min={1}
                  value={waveNumber}
                  onChange={(e) => setWaveNumber(parseInt(e.target.value) || 1)}
                  disabled={!isDraft}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Questions ({questions.length})
          </h2>
          {isDraft && (
            <Button variant="outline" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une question
            </Button>
          )}
        </div>

        {questions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune question. Ajoutez des questions manuellement ou via
              l&apos;import IA.
            </CardContent>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={questions.map((q) => q.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={i}
                    onChange={(updated) => updateQuestion(i, updated)}
                    onDelete={() => deleteQuestion(i)}
                    disabled={!isDraft}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {isDraft && questions.length > 0 && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une question
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
