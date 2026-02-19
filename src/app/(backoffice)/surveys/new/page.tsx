"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";

export default function NewSurveyPage() {
  const [titleFr, setTitleFr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descFr, setDescFr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [societeId, setSocieteId] = useState("");
  const [societes, setSocietes] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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

    if (!societeId) {
      toast.error("Veuillez sélectionner une société");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("surveys")
      .insert({
        title_fr: titleFr,
        title_en: titleEn || null,
        description_fr: descFr || null,
        description_en: descEn || null,
        created_by: user.id,
        status: "draft",
        societe_id: societeId,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Erreur lors de la création", { description: error.message });
    } else {
      toast.success("Sondage créé");
      router.push(`/surveys/${data.id}/edit`);
    }
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
            <div className="space-y-2">
              <Label htmlFor="societe">Société *</Label>
              <Select value={societeId} onValueChange={setSocieteId}>
                <SelectTrigger id="societe">
                  <SelectValue placeholder="Sélectionnez une société..." />
                </SelectTrigger>
                <SelectContent>
                  {societes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                placeholder="Description du sondage..."
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
    </div>
  );
}
