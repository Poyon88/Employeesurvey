"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Eye } from "lucide-react";
import Link from "next/link";

type SurveyInfo = {
  id: string;
  title_fr: string;
  status: string;
  published_at: string | null;
};

export default function MyResultsPage() {
  const supabase = createClient();
  const [surveys, setSurveys] = useState<SurveyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSurveys = useCallback(async () => {
    setLoading(true);

    // Load published and closed surveys
    const { data } = await supabase
      .from("surveys")
      .select("id, title_fr, status, published_at")
      .in("status", ["published", "closed"])
      .order("published_at", { ascending: false });

    setSurveys(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mes résultats</h1>
        <p className="text-muted-foreground">
          Consultez les résultats des sondages pour votre périmètre. Les
          résultats sont filtrés selon vos unités organisationnelles assignées.
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : surveys.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun sondage publié pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {surveys.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{s.title_fr}</CardTitle>
                  <Badge
                    variant={s.status === "published" ? "default" : "outline"}
                  >
                    {s.status === "published" ? "En cours" : "Clôturé"}
                  </Badge>
                </div>
                {s.published_at && (
                  <CardDescription>
                    Publié le{" "}
                    {new Date(s.published_at).toLocaleDateString("fr-FR")}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Link href={`/surveys/${s.id}/results`}>
                  <Button variant="outline" className="w-full">
                    <Eye className="mr-2 h-4 w-4" />
                    Voir les résultats
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
