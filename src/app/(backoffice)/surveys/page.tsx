"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Survey } from "@/lib/types";

type SurveyWithSociete = Survey & {
  societe: { id: string; name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "En préparation",
  published: "Publié",
  closed: "Clôturé",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  published: "default",
  closed: "outline",
};

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<SurveyWithSociete[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("surveys")
      .select("*, societe:organizations!societe_id(id, name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erreur lors du chargement des sondages");
    } else {
      const statusOrder: Record<string, number> = { published: 0, draft: 1, closed: 2 };
      const sorted = (data || []).sort((a, b) => {
        const sa = statusOrder[a.status] ?? 9;
        const sb = statusOrder[b.status] ?? 9;
        if (sa !== sb) return sa - sb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setSurveys(sorted);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  async function handleDelete(survey: Survey) {
    if (survey.status === "published") {
      toast.error("Impossible de supprimer un sondage publié");
      return;
    }
    if (!confirm(`Supprimer le sondage "${survey.title_fr}" ?`)) return;

    const res = await fetch(`/api/surveys/${survey.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erreur lors de la suppression");
    } else {
      toast.success("Sondage supprimé");
      loadSurveys();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sondages</h1>
          <p className="text-muted-foreground">
            Créez et gérez vos sondages employés
          </p>
        </div>
        <Link href="/surveys/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau sondage
          </Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Société</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead>Publié le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : surveys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucun sondage. Créez votre premier sondage.
                </TableCell>
              </TableRow>
            ) : (
              surveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell className="font-medium">
                    <Link href={`/surveys/${survey.id}/edit`} className="hover:underline">
                      {survey.title_fr}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {survey.societe?.name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[survey.status]}>
                      {STATUS_LABELS[survey.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(survey.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    {survey.published_at
                      ? new Date(survey.published_at).toLocaleDateString("fr-FR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/s/${survey.id}?preview=1`} target="_blank">
                        <Button variant="ghost" size="icon" title="Prévisualiser">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/surveys/${survey.id}/edit`}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      {survey.status === "draft" && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(survey)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
