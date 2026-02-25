"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Radio,
  FileEdit,
  ArchiveRestore,
  Copy,
  Clock,
  CalendarCheck,
  Trash2,
  XCircle,
  Building2,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type Societe = { id: string; name: string };

type SurveyDashboard = {
  id: string;
  title_fr: string;
  status: string;
  societe_id: string | null;
  closes_at: string | null;
  closed_at: string | null;
  created_at: string;
  responseCount: number;
  tokenCount: number;
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyDashboard[]>([]);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Load all surveys
    const { data: surveysData } = await supabase
      .from("surveys")
      .select("id, title_fr, status, societe_id, closes_at, closed_at, created_at")
      .order("created_at", { ascending: false });

    if (!surveysData) {
      setLoading(false);
      return;
    }

    // Load response counts per survey
    const { data: responses } = await supabase
      .from("responses")
      .select("survey_id");

    const responseMap = new Map<string, number>();
    for (const r of responses || []) {
      responseMap.set(r.survey_id, (responseMap.get(r.survey_id) || 0) + 1);
    }

    // Load token counts per societe (active only)
    const { data: tokens } = await supabase
      .from("anonymous_tokens")
      .select("societe_id")
      .eq("active", true);

    const tokenMap = new Map<string, number>();
    let totalTokens = 0;
    for (const t of tokens || []) {
      const key = t.societe_id || "__all__";
      tokenMap.set(key, (tokenMap.get(key) || 0) + 1);
      totalTokens++;
    }

    const enriched: SurveyDashboard[] = surveysData.map((s) => ({
      ...s,
      responseCount: responseMap.get(s.id) || 0,
      tokenCount: s.societe_id
        ? tokenMap.get(s.societe_id) || 0
        : totalTokens,
    }));

    setSurveys(enriched);

    // Load societes for filter
    const { data: socData } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("type", "societe")
      .order("name");
    setSocietes(socData || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDuplicate(survey: SurveyDashboard) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Non authentifié");
      return;
    }

    // Create a copy of the survey as draft
    const { data: newSurvey, error: surveyError } = await supabase
      .from("surveys")
      .insert({
        title_fr: `${survey.title_fr} (copie)`,
        status: "draft",
        created_by: user.id,
        societe_id: survey.societe_id,
      })
      .select("id")
      .single();

    if (surveyError || !newSurvey) {
      toast.error("Erreur lors de la duplication", {
        description: surveyError?.message,
      });
      return;
    }

    // Copy sections
    const { data: sections } = await supabase
      .from("survey_sections")
      .select("*")
      .eq("survey_id", survey.id)
      .order("sort_order");

    for (const sec of sections || []) {
      const { data: newSec } = await supabase
        .from("survey_sections")
        .insert({
          survey_id: newSurvey.id,
          title_fr: sec.title_fr,
          sort_order: sec.sort_order,
        })
        .select("id")
        .single();

      if (!newSec) continue;

      // Copy questions in this section
      const { data: questions } = await supabase
        .from("questions")
        .select("*, question_options(*)")
        .eq("survey_id", survey.id)
        .eq("section_id", sec.id)
        .order("sort_order");

      for (const q of questions || []) {
        const { data: newQ } = await supabase
          .from("questions")
          .insert({
            survey_id: newSurvey.id,
            section_id: newSec.id,
            type: q.type,
            text_fr: q.text_fr,
            text_en: q.text_en,
            question_code: q.question_code,
            sort_order: q.sort_order,
            required: q.required,
          })
          .select("id")
          .single();

        if (!newQ) continue;

        // Copy options
        const options = (q.question_options || []).map(
          (o: { text_fr: string; text_en: string | null; value: string | null; sort_order: number }) => ({
            question_id: newQ.id,
            text_fr: o.text_fr,
            text_en: o.text_en,
            value: o.value,
            sort_order: o.sort_order,
          })
        );

        if (options.length > 0) {
          await supabase.from("question_options").insert(options);
        }
      }
    }

    toast.success("Sondage dupliqué");
    loadData();
  }

  async function handleReactivate(survey: SurveyDashboard) {
    if (
      !confirm(
        `Réactiver le sondage "${survey.title_fr}" ? Les personnes n'ayant pas encore répondu pourront le compléter.`
      )
    )
      return;

    const { error } = await supabase
      .from("surveys")
      .update({ status: "published", closed_at: null })
      .eq("id", survey.id);

    if (error) {
      toast.error("Erreur lors de la réactivation", {
        description: error.message,
      });
    } else {
      toast.success("Sondage réactivé");
      loadData();
    }
  }

  async function handleDelete(survey: SurveyDashboard) {
    if (
      !confirm(
        `Supprimer définitivement le sondage "${survey.title_fr}" ?\n\nCette action est irréversible. Toutes les données associées (questions, réponses) seront supprimées.`
      )
    )
      return;

    const { error } = await supabase
      .from("surveys")
      .delete()
      .eq("id", survey.id);

    if (error) {
      toast.error("Erreur lors de la suppression", {
        description: error.message,
      });
    } else {
      toast.success("Sondage supprimé");
      loadData();
    }
  }

  async function handleClose(survey: SurveyDashboard) {
    if (
      !confirm(
        `Clôturer le sondage "${survey.title_fr}" ?\n\nLes répondants ne pourront plus y accéder.`
      )
    )
      return;

    const { error } = await supabase
      .from("surveys")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", survey.id);

    if (error) {
      toast.error("Erreur lors de la clôture", {
        description: error.message,
      });
    } else {
      toast.success("Sondage clôturé");
      loadData();
    }
  }

  function getResponseRate(s: SurveyDashboard) {
    if (s.tokenCount === 0) return null;
    return Math.round((s.responseCount / s.tokenCount) * 100);
  }

  function getDaysUntilClose(s: SurveyDashboard) {
    if (!s.closes_at) return null;
    const now = new Date();
    const close = new Date(s.closes_at);
    const diff = Math.ceil(
      (close.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  }

  const filtered =
    selectedSocieteId === "all"
      ? surveys
      : surveys.filter((s) => s.societe_id === selectedSocieteId);

  const active = filtered.filter((s) => s.status === "published");
  const drafts = filtered.filter((s) => s.status === "draft");
  const closed = filtered.filter((s) => s.status === "closed");

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">
            Vue d&apos;ensemble de vos sondages
          </p>
        </div>
        {societes.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedSocieteId} onValueChange={setSelectedSocieteId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les sociétés</SelectItem>
                {societes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Chargement...</p>
      ) : (
        <>
          {/* Sondages actifs */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-semibold">Sondages actifs</h2>
              <Badge variant="default" className="ml-1">
                {active.length}
              </Badge>
            </div>
            {active.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucun sondage actif
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {active.map((s) => {
                  const rate = getResponseRate(s);
                  const daysLeft = getDaysUntilClose(s);
                  return (
                    <Card key={s.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          <Link
                            href={`/surveys/${s.id}/edit`}
                            className="hover:underline"
                          >
                            {s.title_fr}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">
                              Réponses
                            </span>
                            <span className="font-medium">
                              {rate !== null ? `${rate}%` : "—"}{" "}
                              <span className="text-muted-foreground font-normal">
                                ({s.responseCount}/{s.tokenCount})
                              </span>
                            </span>
                          </div>
                          <Progress value={rate ?? 0} className="h-2" />
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {daysLeft !== null ? (
                            <span
                              className={
                                daysLeft <= 3
                                  ? "text-red-600 font-medium"
                                  : daysLeft <= 7
                                    ? "text-orange-600"
                                    : "text-muted-foreground"
                              }
                            >
                              {daysLeft > 0
                                ? `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`
                                : daysLeft === 0
                                  ? "Se termine aujourd'hui"
                                  : "Date de fin dépassée"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Pas de date de fin
                            </span>
                          )}
                        </div>
                        <div className="flex justify-end gap-1 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClose(s)}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Clôturer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(s)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Dupliquer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(s)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Supprimer
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sondages en préparation */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-semibold">En préparation</h2>
              <Badge variant="secondary" className="ml-1">
                {drafts.length}
              </Badge>
            </div>
            {drafts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucun sondage en préparation
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {drafts.map((s) => (
                  <Card key={s.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        <Link
                          href={`/surveys/${s.id}/edit`}
                          className="hover:underline"
                        >
                          {s.title_fr}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(s)}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Dupliquer
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(s)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Supprimer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Sondages clôturés */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Clôturés</h2>
              <Badge variant="outline" className="ml-1">
                {closed.length}
              </Badge>
            </div>
            {closed.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucun sondage clôturé
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {closed.map((s) => {
                  const rate = getResponseRate(s);
                  return (
                    <Card key={s.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          <Link
                            href={`/surveys/${s.id}/edit`}
                            className="hover:underline"
                          >
                            {s.title_fr}
                          </Link>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <CalendarCheck className="h-3.5 w-3.5" />
                          Clôturé le{" "}
                          {s.closed_at
                            ? new Date(s.closed_at).toLocaleDateString("fr-FR")
                            : "—"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">
                              Réponses
                            </span>
                            <span className="font-medium">
                              {rate !== null ? `${rate}%` : "—"}{" "}
                              <span className="text-muted-foreground font-normal">
                                ({s.responseCount}/{s.tokenCount})
                              </span>
                            </span>
                          </div>
                          <Progress value={rate ?? 0} className="h-2" />
                        </div>
                        <div className="flex justify-end gap-1 pt-1">
                          <Link href={`/surveys/${s.id}/results`}>
                            <Button variant="ghost" size="sm">
                              <BarChart3 className="mr-1 h-3.5 w-3.5" />
                              Résultats
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReactivate(s)}
                          >
                            <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                            Réactiver
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(s)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Dupliquer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(s)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Supprimer
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
