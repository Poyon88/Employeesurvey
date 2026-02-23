"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Ubuntu",
  "Playfair Display",
  "Merriweather",
  "Source Sans 3",
  "PT Sans",
  "Noto Sans",
  "Oswald",
  "Quicksand",
  "Work Sans",
  "Fira Sans",
  "Barlow",
  "Rubik",
  "Karla",
  "Libre Franklin",
  "DM Sans",
  "Manrope",
  "Space Grotesk",
  "Outfit",
  "Plus Jakarta Sans",
  "Lexend",
  "Sora",
  "Archivo",
];

type Societe = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
};

export default function EditSocietePage() {
  const params = useParams();
  const router = useRouter();
  const societeId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1a1a2e");
  const [secondaryColor, setSecondaryColor] = useState("#16213e");
  const [accentColor, setAccentColor] = useState("#0f3460");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set(["Inter"]));

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, logo_url, primary_color, secondary_color, accent_color, font_family")
        .eq("id", societeId)
        .eq("type", "societe")
        .single();

      if (error || !data) {
        toast.error("Societe introuvable");
        router.push("/org-structure");
        return;
      }

      const soc = data as Societe;
      setName(soc.name);
      setPrimaryColor(soc.primary_color || "#1a1a2e");
      setSecondaryColor(soc.secondary_color || "#16213e");
      setAccentColor(soc.accent_color || "#0f3460");
      setFontFamily(soc.font_family || "Inter");
      setExistingLogoUrl(soc.logo_url);
      setLogoPreview(soc.logo_url);

      if (soc.font_family && soc.font_family !== "Inter") {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${soc.font_family.replace(/ /g, "+")}&display=swap`;
        document.head.appendChild(link);
        setLoadedFonts((prev) => new Set(prev).add(soc.font_family!));
      }

      setLoading(false);
    }
    load();
  }, [societeId, supabase, router]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez selectionner une image");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleFontChange(font: string) {
    setFontFamily(font);
    if (!loadedFonts.has(font)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}&display=swap`;
      document.head.appendChild(link);
      setLoadedFonts((prev) => new Set(prev).add(font));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }

    setSaving(true);

    const formData = new FormData();
    formData.append("id", societeId);
    formData.append("name", name.trim());
    formData.append("primary_color", primaryColor);
    formData.append("secondary_color", secondaryColor);
    formData.append("accent_color", accentColor);
    if (fontFamily) formData.append("font_family", fontFamily);
    if (logoFile) formData.append("logo", logoFile);

    const res = await fetch("/api/org-structure/societe", {
      method: "PUT",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error("Erreur", { description: data.error });
      setSaving(false);
      return;
    }

    toast.success(`Societe "${name}" mise a jour`);
    router.push("/org-structure");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayPreview = logoPreview || existingLogoUrl;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Modifier la societe</h1>
        <p className="text-muted-foreground">
          Modifiez les informations et l&apos;identite visuelle
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nom */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la societe *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Acme Corp"
                required
              />
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {displayPreview ? (
                    <img
                      src={displayPreview}
                      alt="Apercu logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {displayPreview ? "Changer" : "Choisir un logo"}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Couleurs */}
        <Card>
          <CardHeader>
            <CardTitle>Couleurs</CardTitle>
            <CardDescription>
              Definissez l&apos;identite visuelle de la societe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Primaire", value: primaryColor, setter: setPrimaryColor },
                { label: "Secondaire", value: secondaryColor, setter: setSecondaryColor },
                { label: "Accent", value: accentColor, setter: setAccentColor },
              ].map(({ label, value, setter }) => (
                <div key={label} className="space-y-2">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded border p-0.5"
                    />
                    <Input
                      value={value}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setter(v);
                      }}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Police */}
        <Card>
          <CardHeader>
            <CardTitle>Police</CardTitle>
            <CardDescription>
              Choisissez la police Google Fonts de la societe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Police</Label>
              <Select value={fontFamily} onValueChange={handleFontChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir une police" />
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_FONTS.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Apercu */}
        <Card>
          <CardHeader>
            <CardTitle>Apercu</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-lg border p-6 space-y-4"
              style={{ fontFamily: `"${fontFamily}", sans-serif` }}
            >
              <div className="flex items-center gap-3">
                {displayPreview && (
                  <img
                    src={displayPreview}
                    alt="Logo"
                    className="h-10 w-10 rounded object-contain"
                  />
                )}
                <h3 className="text-xl font-bold">{name || "Nom de la societe"}</h3>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full border"
                  style={{ backgroundColor: primaryColor }}
                  title="Primaire"
                />
                <div
                  className="h-8 w-8 rounded-full border"
                  style={{ backgroundColor: secondaryColor }}
                  title="Secondaire"
                />
                <div
                  className="h-8 w-8 rounded-full border"
                  style={{ backgroundColor: accentColor }}
                  title="Accent"
                />
                <span className="text-sm text-muted-foreground ml-2">
                  {fontFamily}
                </span>
              </div>
              <p className="text-sm" style={{ fontFamily: `"${fontFamily}", sans-serif` }}>
                Ceci est un exemple de texte avec la police selectionnee. Vos sondages
                utiliseront cette identite visuelle.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/org-structure")}
          >
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}
