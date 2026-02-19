"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, TrendingUp, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
];

type WaveData = {
  surveyId: string;
  title: string;
  waveNumber: number;
  status: string;
  publishedAt: string | null;
  responseCount: number;
  anonymityBlocked: boolean;
  questionAverages: {
    questionCode: string | null;
    questionId: string;
    text_fr: string;
    sortOrder: number;
    average: number | null;
    answerCount: number;
  }[];
};

type WavesResponse = {
  waveGroup: { id: string; name: string } | null;
  currentSurveyId: string;
  waves: WaveData[];
  referenceQuestions: {
    id: string;
    text_fr: string;
    text_en: string | null;
    question_code: string | null;
    sort_order: number;
  }[];
  error?: string;
};

export default function WavesPage() {
  const params = useParams();
  const surveyId = params.id as string;

  const [data, setData] = useState<WavesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWaves = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/surveys/${surveyId}/waves`);
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Erreur");
      setLoading(false);
      return;
    }

    setData(json);
    setLoading(false);
  }, [surveyId]);

  useEffect(() => {
    loadWaves();
  }, [loadWaves]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/surveys/${surveyId}/edit`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Suivi longitudinal</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // Build chart data: each wave is a point on the X axis,
  // each question is a line
  const validWaves = data.waves.filter((w) => !w.anonymityBlocked);

  // Build question labels from reference questions
  const questionLabels: { key: string; code: string | null; label: string }[] =
    data.referenceQuestions.map((rq, i) => ({
      key: rq.question_code || `q${i}`,
      code: rq.question_code,
      label:
        (rq.question_code ? `[${rq.question_code}] ` : "") +
        (rq.text_fr.length > 35
          ? rq.text_fr.substring(0, 35) + "..."
          : rq.text_fr),
    }));

  // Build data points: one entry per wave, with question keys
  const chartData = validWaves.map((w) => {
    const point: Record<string, string | number | null> = {
      name: `Vague ${w.waveNumber}`,
      waveNumber: w.waveNumber,
    };

    questionLabels.forEach((ql, i) => {
      // Match by question_code if available, otherwise by position
      let qa;
      if (ql.code) {
        qa = w.questionAverages.find((a) => a.questionCode === ql.code);
      }
      if (!qa) {
        qa = w.questionAverages[i];
      }
      point[ql.key] = qa?.average ?? null;
    });

    return point;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/surveys/${surveyId}/edit`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Suivi longitudinal</h1>
          {data.waveGroup && (
            <p className="text-sm text-muted-foreground">
              Groupe : {data.waveGroup.name}
            </p>
          )}
        </div>
      </div>

      {/* Wave summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.waves.map((w) => (
          <Card
            key={w.surveyId}
            className={
              w.surveyId === data.currentSurveyId ? "border-primary" : ""
            }
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Vague {w.waveNumber}</Badge>
                <Badge
                  variant={
                    w.status === "published"
                      ? "default"
                      : w.status === "closed"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {w.status === "published"
                    ? "En cours"
                    : w.status === "closed"
                      ? "Clôturé"
                      : "Brouillon"}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-medium">{w.title}</p>
              <p className="text-xs text-muted-foreground">
                {w.responseCount} réponse(s)
              </p>
              {w.anonymityBlocked && (
                <p className="mt-1 text-xs text-orange-600">
                  Masqué (anonymat)
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Anonymity warnings */}
      {data.waves.some((w) => w.anonymityBlocked) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 pt-6">
            <ShieldAlert className="h-5 w-5 text-orange-600" />
            <p className="text-sm text-orange-800">
              Certaines vagues ont moins de 10 répondants et sont exclues du
              graphique pour préserver l&apos;anonymat.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Line chart */}
      {validWaves.length >= 2 && questionLabels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Évolution des scores Likert
            </CardTitle>
            <CardDescription>
              Comparaison des moyennes par question à travers les vagues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Legend />
                  {questionLabels.map((ql, i) => (
                    <Line
                      key={ql.key}
                      type="monotone"
                      dataKey={ql.key}
                      name={ql.label}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {validWaves.length < 2 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {validWaves.length === 0
              ? "Aucune vague avec suffisamment de répondants pour afficher des résultats."
              : "Il faut au moins 2 vagues avec des résultats pour afficher l'évolution."}
          </CardContent>
        </Card>
      )}

      {/* Per-question detail table */}
      {validWaves.length >= 2 && questionLabels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail par question</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">Question</th>
                    {validWaves.map((w) => (
                      <th key={w.surveyId} className="p-2 text-center font-medium">
                        V{w.waveNumber}
                      </th>
                    ))}
                    <th className="p-2 text-center font-medium">Tendance</th>
                  </tr>
                </thead>
                <tbody>
                  {questionLabels.map((ql, qi) => {
                    const values = validWaves
                      .map((w) => {
                        let qa;
                        if (ql.code) {
                          qa = w.questionAverages.find(
                            (a) => a.questionCode === ql.code
                          );
                        }
                        if (!qa) {
                          qa = w.questionAverages[qi];
                        }
                        return qa?.average ?? null;
                      })
                      .filter((v): v is number => v !== null);

                    const trend =
                      values.length >= 2
                        ? values[values.length - 1] - values[0]
                        : 0;

                    return (
                      <tr key={ql.key} className="border-b">
                        <td className="p-2 max-w-[250px] truncate">
                          {ql.label}
                        </td>
                        {validWaves.map((w) => {
                          let qa;
                          if (ql.code) {
                            qa = w.questionAverages.find(
                              (a) => a.questionCode === ql.code
                            );
                          }
                          if (!qa) {
                            qa = w.questionAverages[qi];
                          }
                          const avg = qa?.average ?? null;
                          return (
                            <td key={w.surveyId} className="p-2 text-center">
                              {avg !== null ? avg.toFixed(1) : "—"}
                            </td>
                          );
                        })}
                        <td className="p-2 text-center">
                          {trend > 0 && (
                            <span className="text-green-600 font-medium">
                              +{trend.toFixed(1)}
                            </span>
                          )}
                          {trend < 0 && (
                            <span className="text-red-600 font-medium">
                              {trend.toFixed(1)}
                            </span>
                          )}
                          {trend === 0 && values.length >= 2 && (
                            <span className="text-muted-foreground">=</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
