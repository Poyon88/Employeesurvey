"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Trash2, Plus, X } from "lucide-react";
import type { QuestionType } from "@/lib/types";
import { QUESTION_TYPE_LABELS } from "@/lib/types";

export type EditableQuestion = {
  id: string;
  type: QuestionType;
  text_fr: string;
  text_en: string;
  question_code: string;
  required: boolean;
  options: EditableOption[];
};

export type EditableOption = {
  id: string;
  text_fr: string;
  text_en: string;
};

type QuestionCardProps = {
  question: EditableQuestion;
  index: number;
  onChange: (updated: EditableQuestion) => void;
  onDelete: () => void;
  disabled?: boolean;
};

export function QuestionCard({
  question,
  index,
  onChange,
  onDelete,
  disabled,
}: QuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasOptions =
    question.type === "single_choice" || question.type === "multiple_choice";

  function updateField(field: keyof EditableQuestion, value: string | boolean) {
    const updated = { ...question, [field]: value };
    // Reset options when switching to a type that doesn't need them
    if (
      field === "type" &&
      value !== "single_choice" &&
      value !== "multiple_choice"
    ) {
      updated.options = [];
    }
    // Add default options when switching to a choice type
    if (
      field === "type" &&
      (value === "single_choice" || value === "multiple_choice") &&
      updated.options.length === 0
    ) {
      updated.options = [
        { id: crypto.randomUUID(), text_fr: "", text_en: "" },
        { id: crypto.randomUUID(), text_fr: "", text_en: "" },
      ];
    }
    onChange(updated);
  }

  function addOption() {
    onChange({
      ...question,
      options: [
        ...question.options,
        { id: crypto.randomUUID(), text_fr: "", text_en: "" },
      ],
    });
  }

  function updateOption(optionId: string, field: "text_fr" | "text_en", value: string) {
    onChange({
      ...question,
      options: question.options.map((o) =>
        o.id === optionId ? { ...o, [field]: value } : o
      ),
    });
  }

  function removeOption(optionId: string) {
    if (question.options.length <= 2) return;
    onChange({
      ...question,
      options: question.options.filter((o) => o.id !== optionId),
    });
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={isDragging ? "shadow-lg" : ""}>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            type="button"
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <Badge variant="outline" className="text-xs">
            Q{index + 1}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {QUESTION_TYPE_LABELS[question.type]}
          </Badge>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Label htmlFor={`req-${question.id}`} className="text-xs text-muted-foreground">
              Obligatoire
            </Label>
            <Switch
              id={`req-${question.id}`}
              checked={question.required}
              onCheckedChange={(v) => updateField("required", v)}
              disabled={disabled}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={disabled}
            type="button"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type de question</Label>
              <Select
                value={question.type}
                onValueChange={(v) => updateField("type", v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_choice">Choix unique</SelectItem>
                  <SelectItem value="multiple_choice">Choix multiple</SelectItem>
                  <SelectItem value="likert_5">Échelle de Likert (1-5)</SelectItem>
                  <SelectItem value="likert">Échelle de Likert (1-10)</SelectItem>
                  <SelectItem value="free_text">Texte libre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Code question</Label>
              <Input
                value={question.question_code}
                onChange={(e) => updateField("question_code", e.target.value)}
                placeholder="ex: SAT-01"
                disabled={disabled}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Identifiant stable pour le suivi longitudinal
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Question (FR) *</Label>
              <Input
                value={question.text_fr}
                onChange={(e) => updateField("text_fr", e.target.value)}
                placeholder="Texte de la question en français"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Question (EN)</Label>
              <Input
                value={question.text_en}
                onChange={(e) => updateField("text_en", e.target.value)}
                placeholder="Question text in English"
                disabled={disabled}
              />
            </div>
          </div>

          {hasOptions && (
            <div className="space-y-3">
              <Label>Options de réponse</Label>
              {question.options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                  <Input
                    value={opt.text_fr}
                    onChange={(e) => updateOption(opt.id, "text_fr", e.target.value)}
                    placeholder="Option (FR)"
                    className="flex-1"
                    disabled={disabled}
                  />
                  <Input
                    value={opt.text_en}
                    onChange={(e) => updateOption(opt.id, "text_en", e.target.value)}
                    placeholder="Option (EN)"
                    className="flex-1"
                    disabled={disabled}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(opt.id)}
                    disabled={disabled || question.options.length <= 2}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={disabled}
                type="button"
              >
                <Plus className="mr-1 h-3 w-3" />
                Ajouter une option
              </Button>
            </div>
          )}

          {question.type === "likert" && (
            <p className="text-sm text-muted-foreground">
              Les répondants choisiront une valeur de 1 (pas du tout d&apos;accord) à 10
              (tout à fait d&apos;accord).
            </p>
          )}

          {question.type === "likert_5" && (
            <p className="text-sm text-muted-foreground">
              Les répondants choisiront une valeur de 1 (pas du tout d&apos;accord) à 5
              (tout à fait d&apos;accord).
            </p>
          )}

          {question.type === "free_text" && (
            <p className="text-sm text-muted-foreground">
              Les répondants pourront saisir un texte libre.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
