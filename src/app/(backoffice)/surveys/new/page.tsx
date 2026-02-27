"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Users, Loader2 } from "lucide-react";
import { SurveyFilters, SurveyType } from "@/lib/types";
import FilterPanel from "@/components/survey-filters/filter-panel";

export default function NewSurveyPage() {
  const [titleFr, setTitleFr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descFr, setDescFr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [surveyType, setSurveyType] = useState<SurveyType>("classique");
  const [samplePercentage, setSamplePercentage] = useState<number>(30);
  const [selectedSocieteIds, setSelectedSocieteIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<SurveyFilters>({});
  const [societes, setSocietes] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [populationCount, setPopulationCount] = useState<number | null>(null);
  const [sampleSize, setSampleSize] = useState<number | null>(null);
  const [loadingPopulation, setLoadingPopulation] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const previewTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadSocietes() {
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("type", "societe")
        .order("name");
      setSocietes(data || []);
    }
    loadSocietes();
  }, [supabase]);

  // Debounced population preview
  const previewPopulation = useCallback(async () => {
    const currentFilters = { ...filters, societe_ids: selectedSocieteIds };
    if (selectedSocieteIds.length === 0) {
      setPopulationCount(null);
      setSampleSize(null);
      return;
    }

    setLoadingPopulation(true);
    try {
      const res = await fetch("/api/surveys/preview-population", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: currentFilters,
          survey_type: surveyType,
          sample_percentage: surveyType === "pulse" ? samplePercentage : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPopulationCount(data.totalFiltered);
        setSampleSize(data.sampleSize);
      }
    } catch {
      // silent
    }
    setLoadingPopulation(false);
  }, [filters, selectedSocieteIds, surveyType, samplePercentage]);

  useEffect(() => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewTimeout.current = setTimeout(previewPopulation, 500);
    return () => {
      if (previewTimeout.current) clearTimeout(previewTimeout.current);
    };
  }, [previewPopulation]);

  function toggleSociete(id: string) {
    setSelectedSocieteIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function handleFiltersChange(newFilters: SurveyFilters) {
    setFilters(newFilters);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Non authentifié");
      setSaving(false);
      return;
    }

    if (selectedSocieteIds.length === 0) {
      toast.error("Veuillez sélectionner au moins une société");
      setSaving(false);
      return;
    }

    const allFilters: SurveyFilters = {
      ...filters,
      societe_ids: selectedSocieteIds,
    };

    const { data, error } = await supabase
      .from("surveys")
      .insert({
        title_fr: titleFr,
        title_en: titleEn || null,
        description_fr: descFr || null,
        description_en: descEn || null,
        created_by: user.id,
        status: "draft",
        societe_id: selectedSocieteIds[0],
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        survey_type: surveyType,
        sample_percentage: surveyType === "pulse" ? samplePercentage : null,
        filters: allFilters,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Erreur lors de la création", { description: error.message });
      setSaving(false);
      return;
    }

    // Generate survey_tokens based on filters
    try {
      await fetch(`/api/surveys/${data.id}/generate-tokens`, { method: "POST" });
    } catch {
      // Non-blocking: tokens can be regenerated from distribution page
    }

    toast.success("Sondage créé");
    router.push(`/surveys/${data.id}/edit`);
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nouveau sondage</h1>
        <p className="text-muted-foreground">
          Créez un nouveau sondage, puis ajoutez des questions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>
            Le titre et la description en anglais sont optionnels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Type de sondage */}
            <div className="space-y-2">
              <Label>Type de sondage *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                  <input
                    type="radio"
                    name="survey_type"
                    value="classique"
                    checked={surveyType === "classique"}
                    onChange={() => setSurveyType("classique")}
                    className="accent-primary"
                  />
                  <div>
                    <p className="font-medium text-sm">Classique</p>
                    <p className="text-xs text-muted-foreground">
                      Envoyer à toute la population filtrée
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                  <input
                    type="radio"
                    name="survey_type"
                    value="pulse"
                    checked={surveyType === "pulse"}
                    onChange={() => setSurveyType("pulse")}
                    className="accent-primary"
                  />
                  <div>
                    <p className="font-medium text-sm">Pulse</p>
                    <p className="text-xs text-muted-foreground">
                      Échantillon représentatif automatique
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Sélection multi-société */}
            <div className="space-y-2">
              <Label>Société(s) *</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {societes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune société disponible
                  </p>
                ) : (
                  societes.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSocieteIds.includes(s.id)}
                        onCheckedChange={() => toggleSociete(s.id)}
                      />
                      <span className="text-sm">{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title_fr">Titre (FR) *</Label>
              <Input
                id="title_fr"
                value={titleFr}
                onChange={(e) => setTitleFr(e.target.value)}
                placeholder="Ex: Enquête de satisfaction 2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title_en">Titre (EN)</Label>
              <Input
                id="title_en"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Ex: Satisfaction Survey 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc_fr">Description (FR)</Label>
              <Textarea
                id="desc_fr"
                value={descFr}
                onChange={(e) => setDescFr(e.target.value)}
                placeholder={"Cette enquête est anonyme et a pour objectif d'améliorer nos conditions de travail, notre organisation et notre collaboration.\nMerci de répondre avec sincérité."}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc_en">Description (EN)</Label>
              <Textarea
                id="desc_en"
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                placeholder="Survey description..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closes_at">Date de fin</Label>
              <Input
                id="closes_at"
                type="date"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>

            {/* Pourcentage échantillon (pulse uniquement) */}
            {surveyType === "pulse" && (
              <div className="space-y-2">
                <Label htmlFor="sample_pct">Pourcentage d&apos;échantillon</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="sample_pct"
                    type="number"
                    min={1}
                    max={100}
                    value={samplePercentage}
                    onChange={(e) =>
                      setSamplePercentage(Number(e.target.value) || 30)
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  L&apos;algorithme sélectionnera un échantillon stratifié
                  proportionnel de cette taille
                </p>
              </div>
            )}

            {/* Aperçu population */}
            {selectedSocieteIds.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                {loadingPopulation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div className="text-sm">
                    <span className="font-medium">
                      {populationCount ?? "—"} personne(s)
                    </span>{" "}
                    ciblée(s)
                    {surveyType === "pulse" && sampleSize != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        &rarr; échantillon de ~{sampleSize} personne(s)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Création..." : "Créer le sondage"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Annuler
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Panneau de filtres */}
      <FilterPanel
        societeIds={selectedSocieteIds}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />
    </div>
  );
}
