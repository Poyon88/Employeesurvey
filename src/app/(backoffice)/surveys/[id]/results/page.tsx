"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, ShieldAlert, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#e11d48",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
  "#be185d",
  "#059669",
];

type Org = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type OptionResult = {
  id: string;
  text_fr: string;
  text_en: string | null;
  count: number;
  percentage: number;
};

type SectionInfo = {
  id: string;
  title_fr: string;
  sort_order: number;
};

type QuestionResult = {
  id: string;
  type: string;
  text_fr: string;
  text_en: string | null;
  sort_order: number;
  section_id: string | null;
  // choices
  options?: OptionResult[];
  totalAnswers?: number;
  // likert
  average?: number;
  distribution?: { value: number; count: number }[];
  // free_text
  responses?: string[];
};

type ResultsData = {
  survey: { id: string; title_fr: string; title_en: string | null } | null;
  totalResponses: number;
  sections: SectionInfo[];
  questions: QuestionResult[];
  organizations?: Org[];
  demographicOptions?: Record<string, string[]>;
  anonymityBlocked?: boolean;
  message?: string;
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;

  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [societeId, setSocieteId] = useState<string>("");
  const [directionId, setDirectionId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [sexeFilter, setSexeFilter] = useState("");
  const [fonctionFilter, setFonctionFilter] = useState("");
  const [lieuTravailFilter, setLieuTravailFilter] = useState("");
  const [typeContratFilter, setTypeContratFilter] = useState("");
  const [tempsTravailFilter, setTempsTravailFilter] = useState("");
  const [costCenterFilter, setCostCenterFilter] = useState("");
  const [ageMinFilter, setAgeMinFilter] = useState("");
  const [ageMaxFilter, setAgeMaxFilter] = useState("");
  const [seniorityMinFilter, setSeniorityMinFilter] = useState("");
  const [seniorityMaxFilter, setSeniorityMaxFilter] = useState("");

  const loadResults = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (societeId) params.set("societe_id", societeId);
    if (directionId) params.set("direction_id", directionId);
    if (departmentId) params.set("department_id", departmentId);
    if (serviceId) params.set("service_id", serviceId);
    if (sexeFilter) params.set("sexe", sexeFilter);
    if (fonctionFilter) params.set("fonction", fonctionFilter);
    if (lieuTravailFilter) params.set("lieu_travail", lieuTravailFilter);
    if (typeContratFilter) params.set("type_contrat", typeContratFilter);
    if (tempsTravailFilter) params.set("temps_travail", tempsTravailFilter);
    if (costCenterFilter) params.set("cost_center", costCenterFilter);
    if (ageMinFilter) params.set("age_min", ageMinFilter);
    if (ageMaxFilter) params.set("age_max", ageMaxFilter);
    if (seniorityMinFilter) params.set("seniority_min", seniorityMinFilter);
    if (seniorityMaxFilter) params.set("seniority_max", seniorityMaxFilter);

    const res = await fetch(
      `/api/surveys/${surveyId}/results?${params.toString()}`
    );
    if (!res.ok) {
      toast.error("Erreur lors du chargement des résultats");
      setLoading(false);
      return;
    }

    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [surveyId, societeId, directionId, departmentId, serviceId, sexeFilter, fonctionFilter, lieuTravailFilter, typeContratFilter, tempsTravailFilter, costCenterFilter, ageMinFilter, ageMaxFilter, seniorityMinFilter, seniorityMaxFilter]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const societes =
    data?.organizations?.filter((o) => o.type === "societe") || [];
  const directions =
    data?.organizations?.filter(
      (o) => o.type === "direction" && (!societeId || o.parent_id === societeId)
    ) || [];
  const departments =
    data?.organizations?.filter(
      (o) => o.type === "department" && (!directionId || o.parent_id === directionId)
    ) || [];
  const services =
    data?.organizations?.filter(
      (o) => o.type === "service" && (!departmentId || o.parent_id === departmentId)
    ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Chargement des résultats...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Résultats</h1>
            <p className="text-sm text-muted-foreground">
              {data?.survey?.title_fr}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {data?.totalResponses || 0} réponse(s)
        </Badge>
      </div>

      {/* Org filters */}
      {data?.organizations && data.organizations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtrer par structure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <Select
                value={societeId}
                onValueChange={(v) => {
                  setSocieteId(v === "all" ? "" : v);
                  setDirectionId("");
                  setDepartmentId("");
                  setServiceId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Société" />
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

              <Select
                value={directionId}
                onValueChange={(v) => {
                  setDirectionId(v === "all" ? "" : v);
                  setDepartmentId("");
                  setServiceId("");
                }}
                disabled={!societeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les directions</SelectItem>
                  {directions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v === "all" ? "" : v);
                  setServiceId("");
                }}
                disabled={!directionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Département" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={serviceId}
                onValueChange={(v) => setServiceId(v === "all" ? "" : v)}
                disabled={!departmentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les services</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Demographic filters */}
      {data?.demographicOptions && Object.values(data.demographicOptions).some((v) => v.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtrer par données démographiques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.demographicOptions.sexe?.length > 0 && (
                <Select
                  value={sexeFilter}
                  onValueChange={(v) => setSexeFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sexe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {data.demographicOptions.sexe.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {data.demographicOptions.fonctions?.length > 0 && (
                <Select
                  value={fonctionFilter}
                  onValueChange={(v) => setFonctionFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fonction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {data.demographicOptions.fonctions.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {data.demographicOptions.lieux_travail?.length > 0 && (
                <Select
                  value={lieuTravailFilter}
                  onValueChange={(v) => setLieuTravailFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Lieu de travail" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {data.demographicOptions.lieux_travail.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {data.demographicOptions.types_contrat?.length > 0 && (
                <Select
                  value={typeContratFilter}
                  onValueChange={(v) => setTypeContratFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type de contrat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {data.demographicOptions.types_contrat.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {data.demographicOptions.temps_travail?.length > 0 && (
                <Select
                  value={tempsTravailFilter}
                  onValueChange={(v) => setTempsTravailFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Temps de travail" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {data.demographicOptions.temps_travail.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {data.demographicOptions.cost_centers?.length > 0 && (
                <Select
                  value={costCenterFilter}
                  onValueChange={(v) => setCostCenterFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cost center" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {data.demographicOptions.cost_centers.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {/* Age and seniority ranges */}
            {(data.demographicOptions.hasDateNaissance || data.demographicOptions.hasDateEntree) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.demographicOptions.hasDateNaissance && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Âge :</Label>
                    <Input
                      type="number"
                      placeholder="Min"
                      className="w-20"
                      value={ageMinFilter}
                      onChange={(e) => setAgeMinFilter(e.target.value)}
                    />
                    <span className="text-sm">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      className="w-20"
                      value={ageMaxFilter}
                      onChange={(e) => setAgeMaxFilter(e.target.value)}
                    />
                  </div>
                )}
                {data.demographicOptions.hasDateEntree && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Ancienneté :</Label>
                    <Input
                      type="number"
                      placeholder="Min"
                      className="w-20"
                      value={seniorityMinFilter}
                      onChange={(e) => setSeniorityMinFilter(e.target.value)}
                    />
                    <span className="text-sm">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      className="w-20"
                      value={seniorityMaxFilter}
                      onChange={(e) => setSeniorityMaxFilter(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Anonymity warning */}
      {data?.anonymityBlocked && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 pt-6">
            <ShieldAlert className="h-5 w-5 text-orange-600" />
            <p className="text-sm text-orange-800">{data.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Question results */}
      {!data?.anonymityBlocked &&
        data?.questions.map((q, i) => {
          // Show section header when entering a new section
          const prevSectionId = i > 0 ? data.questions[i - 1].section_id : null;
          const showSection = q.section_id && q.section_id !== prevSectionId;
          const sectionTitle = showSection
            ? data.sections?.find((s) => s.id === q.section_id)?.title_fr
            : null;

          return (
            <div key={q.id} className="space-y-4">
              {sectionTitle && (
                <div className="rounded-lg border-l-4 border-primary bg-muted/50 px-4 py-3 mt-2">
                  <h3 className="font-semibold text-sm">{sectionTitle}</h3>
                </div>
              )}
              <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Q{i + 1}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {q.type === "single_choice"
                    ? "Choix unique"
                    : q.type === "multiple_choice"
                      ? "Choix multiple"
                      : q.type === "likert"
                        ? "Likert (1-10)"
                        : q.type === "likert_5"
                          ? "Likert (1-5)"
                          : "Texte libre"}
                </Badge>
              </div>
              <CardTitle className="text-base">{q.text_fr}</CardTitle>
              <CardDescription>
                {q.totalAnswers} réponse(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(q.type === "single_choice" || q.type === "multiple_choice") &&
                q.options && (
                  <div className="space-y-4">
                    {/* Bar chart */}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={q.options.map((o) => ({
                            name:
                              o.text_fr.length > 25
                                ? o.text_fr.substring(0, 25) + "..."
                                : o.text_fr,
                            count: o.count,
                            percentage: o.percentage,
                          }))}
                          layout="vertical"
                          margin={{ left: 20, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={150}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(value) => [
                              `${value} réponse(s)`,
                              "Réponses",
                            ]}
                          />
                          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Pie chart for single choice */}
                    {q.type === "single_choice" && q.options.length <= 8 && (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={q.options
                                .filter((o) => o.count > 0)
                                .map((o) => ({
                                  name: o.text_fr,
                                  value: o.count,
                                }))}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                              }
                            >
                              {q.options
                                .filter((o) => o.count > 0)
                                .map((_, index) => (
                                  <Cell
                                    key={index}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                            </Pie>
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

              {(q.type === "likert" || q.type === "likert_5") && q.distribution && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <span className="text-3xl font-bold text-primary">
                      {q.average}
                    </span>
                    <span className="text-muted-foreground">/10</span>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={q.distribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="value" />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          formatter={(value) => [
                            `${value} réponse(s)`,
                            "Réponses",
                          ]}
                        />
                        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {q.type === "free_text" && q.responses && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {q.responses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune réponse textuelle.
                    </p>
                  ) : (
                    q.responses.map((text, j) => (
                      <div
                        key={j}
                        className="rounded border bg-muted/50 p-3 text-sm"
                      >
                        {text}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          );
        })}

      {!data?.anonymityBlocked &&
        data?.questions.length === 0 &&
        data.totalResponses === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune réponse pour le moment.
            </CardContent>
          </Card>
        )}
    </div>
  );
}
