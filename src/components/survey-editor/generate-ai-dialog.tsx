"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { QUESTION_TYPE_LABELS } from "@/lib/types";
import type { GeneratedSurvey } from "@/lib/ai/generate-survey";

const TEMPLATES = [
  { id: "satisfaction", label: "Satisfaction" },
  { id: "engagement", label: "Engagement" },
  { id: "qvt", label: "QVT" },
  { id: "onboarding", label: "Onboarding" },
  { id: "management", label: "Management" },
  { id: "360", label: "Feedback 360" },
  { id: "depart", label: "Enquete de depart" },
];

const QUESTION_TYPES = [
  { id: "likert_5", label: "Echelle 1-5" },
  { id: "likert", label: "Echelle 1-10" },
  { id: "single_choice", label: "Choix unique" },
  { id: "multiple_choice", label: "Choix multiples" },
  { id: "free_text", label: "Texte libre" },
];

interface GenerateAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (survey: GeneratedSurvey) => void;
}

export function GenerateAIDialog({
  open,
  onOpenChange,
  onInsert,
}: GenerateAIDialogProps) {
  const [step, setStep] = useState<"input" | "preview">("input");
  const [prompt, setPrompt] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number | "">("");
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeneratedSurvey | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/generate-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedTemplate
            ? `${prompt || "Genere un sondage complet et professionnel."}`
            : prompt,
          template: selectedTemplate || undefined,
          questionCount: questionCount || undefined,
          allowedTypes: allowedTypes.length > 0 ? allowedTypes : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la generation");
      }

      const data = await res.json();
      setResult(data);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (result) {
      onInsert(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setStep("input");
    setPrompt("");
    setSelectedTemplate(null);
    setQuestionCount("");
    setAllowedTypes([]);
    setShowAdvanced(false);
    setError("");
    setResult(null);
    onOpenChange(false);
  };

  const toggleType = (typeId: string) => {
    setAllowedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const totalQuestions = result
    ? result.sections.reduce((sum, s) => sum + s.questions.length, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {step === "input" ? "Generer un sondage par IA" : "Apercu du sondage genere"}
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            {/* Templates rapides */}
            <div className="space-y-2">
              <Label>Templates rapides</Label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <Badge
                    key={t.id}
                    variant={selectedTemplate === t.id ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() =>
                      setSelectedTemplate(selectedTemplate === t.id ? null : t.id)
                    }
                  >
                    {t.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">
                Decrivez le sondage souhaite {selectedTemplate && "(optionnel avec un template)"}
              </Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  selectedTemplate
                    ? "Ajoutez des instructions specifiques (ex: focus sur le teletravail, 20 questions, inclure une section sur la diversite...)"
                    : "Ex: Sondage de satisfaction sur le bien-etre au travail pour une entreprise de 200 employes, avec des questions sur le management, l'environnement de travail et l'equilibre vie pro/perso"
                }
                rows={4}
              />
            </div>

            {/* Options avancees */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  Options avancees
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="question-count">Nombre de questions</Label>
                  <Input
                    id="question-count"
                    type="number"
                    min={5}
                    max={50}
                    value={questionCount}
                    onChange={(e) =>
                      setQuestionCount(e.target.value ? Number(e.target.value) : "")
                    }
                    placeholder="Automatique"
                    className="w-32"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Types de questions autorises</Label>
                  <div className="flex flex-wrap gap-3">
                    {QUESTION_TYPES.map((qt) => (
                      <label key={qt.id} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={allowedTypes.includes(qt.id)}
                          onCheckedChange={() => toggleType(qt.id)}
                        />
                        <span className="text-sm">{qt.label}</span>
                      </label>
                    ))}
                  </div>
                  {allowedTypes.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Tous les types sont autorises par defaut
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={loading || (!prompt.trim() && !selectedTemplate)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generation en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generer
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && result && (
          <div className="space-y-4">
            {/* Survey metadata */}
            <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
              <h3 className="font-semibold">{result.title}</h3>
              <p className="text-sm text-muted-foreground">{result.description}</p>
              {result.introduction && (
                <p className="text-sm italic border-l-2 pl-3 text-muted-foreground">
                  {result.introduction}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-3 text-sm">
              <Badge variant="outline">{result.sections.length} section(s)</Badge>
              <Badge variant="outline">{totalQuestions} question(s)</Badge>
            </div>

            {/* Sections & Questions */}
            <div className="space-y-4 max-h-[40vh] overflow-y-auto">
              {result.sections.map((section, si) => (
                <div key={si} className="space-y-2">
                  <h4 className="font-medium text-sm bg-muted px-3 py-1.5 rounded">
                    {section.name}
                  </h4>
                  <div className="space-y-1 pl-2">
                    {section.questions.map((q, qi) => (
                      <div
                        key={qi}
                        className="flex items-start gap-2 text-sm py-1 border-b last:border-0"
                      >
                        <span className="font-mono text-xs text-muted-foreground mt-0.5 shrink-0">
                          {q.question_code}
                        </span>
                        <span className="flex-1">{q.text_fr}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {QUESTION_TYPE_LABELS[q.type] || q.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>
                Modifier le prompt
              </Button>
              <Button onClick={handleInsert}>
                <Sparkles className="mr-2 h-4 w-4" />
                Inserer dans le sondage
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
