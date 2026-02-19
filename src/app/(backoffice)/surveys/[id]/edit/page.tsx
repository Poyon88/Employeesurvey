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
  ChevronUp,
  ChevronDown,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Survey, Question, QuestionOption } from "@/lib/types";
import {
  QuestionCard,
  type EditableQuestion,
} from "@/components/survey-editor/question-card";

type EditableSection = {
  id: string;
  title_fr: string;
  questions: EditableQuestion[];
};

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
  const [introFr, setIntroFr] = useState("");
  const [introEn, setIntroEn] = useState("");
  const [societeId, setSocieteId] = useState<string>("");
  const [societes, setSocietes] = useState<{ id: string; name: string }[]>([]);
  const [waveGroupId, setWaveGroupId] = useState<string>("");
  const [waveNumber, setWaveNumber] = useState<number>(1);
  const [waveGroups, setWaveGroups] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [newWaveGroupName, setNewWaveGroupName] = useState("");
  const [creatingWaveGroup, setCreatingWaveGroup] = useState(false);
  const [showNewWaveGroup, setShowNewWaveGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

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
    setIntroFr(surveyData.introduction_fr || "");
    setIntroEn(surveyData.introduction_en || "");
    setSocieteId(surveyData.societe_id || "");
    setWaveGroupId(surveyData.wave_group_id || "");
    setWaveNumber(surveyData.wave_number || 1);

    // Load societes
    const { data: socData } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("type", "societe")
      .order("name");
    setSocietes(socData || []);

    // Load wave groups
    const { data: wgData } = await supabase
      .from("wave_groups")
      .select("id, name")
      .order("name");
    setWaveGroups(wgData || []);

    // Load sections
    const { data: sectionsData } = await supabase
      .from("survey_sections")
      .select("id, title_fr, sort_order")
      .eq("survey_id", surveyId)
      .order("sort_order");

    // Load questions
    const { data: questionsData } = await supabase
      .from("questions")
      .select("*, question_options(*)")
      .eq("survey_id", surveyId)
      .order("sort_order");

    const allQuestions = (questionsData || []).map(
      (q: Question & { question_options: QuestionOption[] }) => ({
        id: q.id,
        type: q.type,
        text_fr: q.text_fr,
        text_en: q.text_en || "",
        question_code: q.question_code || "",
        required: q.required,
        sectionId: q.section_id || null,
        options: (q.question_options || [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o) => ({
            id: o.id,
            text_fr: o.text_fr,
            text_en: o.text_en || "",
          })),
      })
    );

    // Build sections with their questions
    const loadedSections: EditableSection[] = [];

    // Unsectioned questions go into a default section
    const unsectioned = allQuestions.filter((q: { sectionId: string | null }) => !q.sectionId);
    if (unsectioned.length > 0 && (!sectionsData || sectionsData.length === 0)) {
      // Backward compat: no sections exist, put all in a default section
      loadedSections.push({
        id: crypto.randomUUID(),
        title_fr: "Général",
        questions: unsectioned,
      });
    } else {
      // Add defined sections with their questions
      for (const sec of sectionsData || []) {
        loadedSections.push({
          id: sec.id,
          title_fr: sec.title_fr,
          questions: allQuestions.filter(
            (q: { sectionId: string | null }) => q.sectionId === sec.id
          ),
        });
      }
      // If there are unsectioned questions alongside existing sections, add them to a default section
      if (unsectioned.length > 0) {
        loadedSections.unshift({
          id: crypto.randomUUID(),
          title_fr: "Sans section",
          questions: unsectioned,
        });
      }
    }

    // If no sections and no questions, start with one empty section
    if (loadedSections.length === 0) {
      loadedSections.push({
        id: crypto.randomUUID(),
        title_fr: "Section 1",
        questions: [],
      });
    }

    setSections(loadedSections);
    setLoading(false);
  }, [supabase, surveyId, router]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  // Section management
  function addSection() {
    setSections([
      ...sections,
      {
        id: crypto.randomUUID(),
        title_fr: `Section ${sections.length + 1}`,
        questions: [],
      },
    ]);
  }

  function updateSectionTitle(sectionIndex: number, title: string) {
    const updated = [...sections];
    updated[sectionIndex] = { ...updated[sectionIndex], title_fr: title };
    setSections(updated);
  }

  function deleteSection(sectionIndex: number) {
    if (sections[sectionIndex].questions.length > 0) {
      if (!confirm("Cette section contient des questions. Les questions seront déplacées dans la section précédente ou suivante.")) return;
      const targetIndex = sectionIndex > 0 ? sectionIndex - 1 : sectionIndex + 1;
      if (targetIndex >= 0 && targetIndex < sections.length && targetIndex !== sectionIndex) {
        const updated = [...sections];
        updated[targetIndex] = {
          ...updated[targetIndex],
          questions: [...updated[targetIndex].questions, ...sections[sectionIndex].questions],
        };
        updated.splice(sectionIndex, 1);
        setSections(updated);
        return;
      }
    }
    setSections(sections.filter((_, i) => i !== sectionIndex));
  }

  function moveSectionUp(index: number) {
    if (index === 0) return;
    const updated = [...sections];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setSections(updated);
  }

  function moveSectionDown(index: number) {
    if (index >= sections.length - 1) return;
    const updated = [...sections];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setSections(updated);
  }

  // Question management within sections
  function addQuestion(sectionIndex: number) {
    const updated = [...sections];
    updated[sectionIndex] = {
      ...updated[sectionIndex],
      questions: [
        ...updated[sectionIndex].questions,
        {
          id: crypto.randomUUID(),
          type: "single_choice",
          text_fr: "",
          text_en: "",
          question_code: "",
          required: true,
          options: [
            { id: crypto.randomUUID(), text_fr: "", text_en: "" },
            { id: crypto.randomUUID(), text_fr: "", text_en: "" },
          ],
        },
      ],
    };
    setSections(updated);
  }

  function updateQuestion(sectionIndex: number, questionIndex: number, updated: EditableQuestion) {
    const newSections = [...sections];
    const newQuestions = [...newSections[sectionIndex].questions];
    newQuestions[questionIndex] = updated;
    newSections[sectionIndex] = { ...newSections[sectionIndex], questions: newQuestions };
    setSections(newSections);
  }

  function deleteQuestion(sectionIndex: number, questionIndex: number) {
    const newSections = [...sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      questions: newSections[sectionIndex].questions.filter((_, i) => i !== questionIndex),
    };
    setSections(newSections);
  }

  function handleDragEnd(sectionIndex: number) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const sec = sections[sectionIndex];
      const oldIndex = sec.questions.findIndex((q) => q.id === active.id);
      const newIndex = sec.questions.findIndex((q) => q.id === over.id);

      const newSections = [...sections];
      newSections[sectionIndex] = {
        ...newSections[sectionIndex],
        questions: arrayMove(sec.questions, oldIndex, newIndex),
      };
      setSections(newSections);
    };
  }

  // Wave group management
  async function handleCreateWaveGroup() {
    if (!newWaveGroupName.trim()) return;
    setCreatingWaveGroup(true);

    const { data, error } = await supabase
      .from("wave_groups")
      .insert({ name: newWaveGroupName.trim() })
      .select("id, name")
      .single();

    if (error) {
      toast.error("Erreur lors de la création", { description: error.message });
    } else if (data) {
      setWaveGroups([...waveGroups, data].sort((a, b) => a.name.localeCompare(b.name)));
      setWaveGroupId(data.id);
      setNewWaveGroupName("");
      setShowNewWaveGroup(false);
      toast.success(`Groupe "${data.name}" créé`);
    }
    setCreatingWaveGroup(false);
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
        introduction_fr: introFr || null,
        introduction_en: introEn || null,
        societe_id: societeId || null,
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

    // Delete existing questions and sections
    await supabase.from("questions").delete().eq("survey_id", surveyId);
    await supabase.from("survey_sections").delete().eq("survey_id", surveyId);

    // Insert sections and questions
    let globalQuestionOrder = 0;

    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si];

      // Insert section
      const { data: insertedSec, error: secError } = await supabase
        .from("survey_sections")
        .insert({
          survey_id: surveyId,
          title_fr: sec.title_fr,
          sort_order: si,
        })
        .select("id")
        .single();

      if (secError || !insertedSec) {
        toast.error(`Erreur section "${sec.title_fr}"`, { description: secError?.message });
        setSaving(false);
        return;
      }

      // Insert questions in this section
      for (let qi = 0; qi < sec.questions.length; qi++) {
        const q = sec.questions[qi];
        if (!q.text_fr.trim()) continue;

        const { data: insertedQ, error: qError } = await supabase
          .from("questions")
          .insert({
            survey_id: surveyId,
            section_id: insertedSec.id,
            type: q.type,
            text_fr: q.text_fr,
            text_en: q.text_en || null,
            question_code: q.question_code || null,
            sort_order: globalQuestionOrder++,
            required: q.required,
          })
          .select("id")
          .single();

        if (qError || !insertedQ) {
          toast.error(`Erreur question ${qi + 1}`, { description: qError?.message });
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
              toast.error(`Erreur options question ${qi + 1}`, {
                description: oError.message,
              });
              setSaving(false);
              return;
            }
          }
        }
      }
    }

    // Clear translation cache since content changed
    await supabase
      .from("survey_translations_cache")
      .delete()
      .eq("survey_id", surveyId);

    toast.success("Sondage sauvegardé");
    loadSurvey();
    setSaving(false);
  }

  async function handlePublish() {
    if (totalQuestions === 0) {
      toast.error("Ajoutez au moins une question avant de publier");
      return;
    }

    const emptyQuestions = sections.flatMap((s) =>
      s.questions.filter((q) => !q.text_fr.trim())
    );
    if (emptyQuestions.length > 0) {
      toast.error("Certaines questions n'ont pas de texte");
      return;
    }

    if (!confirm("Publier ce sondage ? Il ne pourra plus être modifié.")) return;

    setPublishing(true);
    await handleSave();

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
              <Label>Introduction (FR)</Label>
              <Textarea
                value={introFr}
                onChange={(e) => setIntroFr(e.target.value)}
                rows={4}
                placeholder="Texte d'introduction affiché aux répondants avant le questionnaire..."
                disabled={!isDraft}
              />
            </div>
            <div className="space-y-2">
              <Label>Introduction (EN)</Label>
              <Textarea
                value={introEn}
                onChange={(e) => setIntroEn(e.target.value)}
                rows={4}
                placeholder="Introduction text shown to respondents before the survey..."
                disabled={!isDraft}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Société *</Label>
            <Select
              value={societeId || "none"}
              onValueChange={(v) => setSocieteId(v === "none" ? "" : v)}
              disabled={!isDraft}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez une société..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune société</SelectItem>
                {societes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Groupe de vagues (suivi longitudinal)</Label>
              {showNewWaveGroup ? (
                <div className="flex gap-2">
                  <Input
                    value={newWaveGroupName}
                    onChange={(e) => setNewWaveGroupName(e.target.value)}
                    placeholder="Nom du groupe..."
                    onKeyDown={(e) => e.key === "Enter" && handleCreateWaveGroup()}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateWaveGroup}
                    disabled={creatingWaveGroup || !newWaveGroupName.trim()}
                  >
                    {creatingWaveGroup ? "..." : "Créer"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowNewWaveGroup(false); setNewWaveGroupName(""); }}
                  >
                    Annuler
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
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
                  {isDraft && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setShowNewWaveGroup(true)}
                      title="Créer un nouveau groupe"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
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

      {/* Sections & Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Sections & Questions ({totalQuestions} question{totalQuestions !== 1 ? "s" : ""})
          </h2>
          {isDraft && (
            <Button variant="outline" onClick={addSection}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Ajouter une section
            </Button>
          )}
        </div>

        {sections.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune section. Ajoutez une section pour commencer.
            </CardContent>
          </Card>
        ) : (
          sections.map((section, si) => {
            // Running question number across all sections
            let questionOffset = 0;
            for (let i = 0; i < si; i++) {
              questionOffset += sections[i].questions.length;
            }

            return (
              <Card key={section.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs">
                      Section {si + 1}
                    </Badge>
                    <div className="flex-1">
                      {isDraft ? (
                        <Input
                          value={section.title_fr}
                          onChange={(e) => updateSectionTitle(si, e.target.value)}
                          placeholder="Titre de la section..."
                          className="h-8 font-semibold"
                        />
                      ) : (
                        <span className="font-semibold">{section.title_fr}</span>
                      )}
                    </div>
                    {isDraft && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveSectionUp(si)}
                          disabled={si === 0}
                          title="Monter"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveSectionDown(si)}
                          disabled={si === sections.length - 1}
                          title="Descendre"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        {sections.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteSection(si)}
                            title="Supprimer la section"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {section.questions.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Aucune question dans cette section.
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd(si)}
                    >
                      <SortableContext
                        items={section.questions.map((q) => q.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-4">
                          {section.questions.map((q, qi) => (
                            <QuestionCard
                              key={q.id}
                              question={q}
                              index={questionOffset + qi}
                              onChange={(updated) => updateQuestion(si, qi, updated)}
                              onDelete={() => deleteQuestion(si, qi)}
                              disabled={!isDraft}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {isDraft && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addQuestion(si)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Ajouter une question
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {isDraft && sections.length > 0 && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={addSection}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Ajouter une section
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
