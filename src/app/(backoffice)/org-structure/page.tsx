"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Download,
  FileDown,
  Building2,
  Info,
  Users,
  AlertCircle,
  CheckCircle,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

type OrgUnit = {
  id: string;
  name: string;
  type: "societe" | "direction" | "department" | "service";
  parent_id: string | null;
  logo_url: string | null;
  created_at: string;
};

type ImportSummary = {
  employees: number;
  societes: number;
  directions: number;
  departments: number;
  services: number;
  tokens: number;
  tokensUpdated: number;
};

type TokenMapping = {
  email: string;
  nom: string;
  token: string;
  societe: string;
  direction: string;
  departement: string;
  service: string;
};

const TYPE_LABELS: Record<string, string> = {
  societe: "Société",
  direction: "Direction",
  department: "Département",
  service: "Service",
};

const TYPE_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  societe: "outline",
  direction: "destructive",
  department: "default",
  service: "secondary",
};

export default function OrgStructurePage() {
  const [orgs, setOrgs] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [tokenMappings, setTokenMappings] = useState<TokenMapping[]>([]);
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>("all");
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const supabase = createClient();

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("type")
      .order("name");

    if (error) {
      toast.error("Erreur lors du chargement");
    } else {
      setOrgs(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      toast.error("Format non supporté. Utilisez CSV ou Excel (.xlsx).");
      return;
    }

    setUploading(true);
    setImportErrors([]);
    setSummary(null);
    setTokenMappings([]);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/org-structure/import", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok && !data.errors) {
      toast.error("Erreur lors de l'import", {
        description: data.error || "Une erreur est survenue",
      });
    } else {
      if (data.errors?.length > 0) {
        setImportErrors(data.errors);
      }
      if (data.summary) {
        setSummary(data.summary);
        setTokenMappings(data.tokenMappings || []);
        toast.success("Import réussi", {
          description: `${data.summary.employees} employés traités — ${data.summary.tokens} nouveaux tokens, ${data.summary.tokensUpdated} mis à jour`,
        });
        loadOrgs();
      }
    }

    setUploading(false);
    // Reset input
    e.target.value = "";
  }

  function downloadDistributionCSV() {
    if (tokenMappings.length === 0) return;

    const header = "Email,Nom,Token,Société,Direction,Departement,Service";
    const rows = tokenMappings.map(
      (t) =>
        `${t.email},${t.nom},${t.token},${t.societe},${t.direction},${t.departement},${t.service}`
    );
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tokens_distribution.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleLogoUpload(
    societeId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image (PNG, JPG, SVG...)");
      return;
    }

    setUploadingLogoId(societeId);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("societeId", societeId);

    const res = await fetch("/api/org-structure/logo", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error("Erreur lors de l'upload", {
        description: data.error || "Une erreur est survenue",
      });
    } else {
      toast.success("Logo importé");
      loadOrgs();
    }

    setUploadingLogoId(null);
    e.target.value = "";
  }

  async function handleLogoDelete(societe: OrgUnit) {
    if (!confirm(`Supprimer le logo de "${societe.name}" ?`)) return;

    const res = await fetch("/api/org-structure/logo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ societeId: societe.id }),
    });

    if (!res.ok) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Logo supprimé");
      loadOrgs();
    }
  }

  async function handleDeleteSociete(societe: OrgUnit) {
    const confirmed = confirm(
      `Supprimer la société "${societe.name}" ?\n\n` +
        `⚠️ ATTENTION : Cette action est irréversible.\n\n` +
        `Toutes les informations liées à cette société seront définitivement supprimées :\n` +
        `- Structure organisationnelle (directions, départements, services)\n` +
        `- Employés et tokens anonymes\n` +
        `- Sondages associés et leurs réponses\n` +
        `- Logo de la société`
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/org-structure/societe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ societeId: societe.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Erreur lors de la suppression", {
          description: data.error || "Une erreur est survenue",
        });
      } else {
        toast.success(`Société "${societe.name}" supprimée`);
        loadOrgs();
      }
    } catch {
      toast.error("Erreur réseau lors de la suppression");
    }
  }

  // Build hierarchy for display
  const societesList = orgs.filter((o) => o.type === "societe");
  const directions = orgs.filter((o) => o.type === "direction");
  const filteredSocietes =
    selectedSocieteId === "all"
      ? societesList
      : societesList.filter((s) => s.id === selectedSocieteId);
  const rootNodes =
    societesList.length > 0 ? filteredSocietes : directions;
  const getChildren = (parentId: string) =>
    orgs.filter((o) => o.parent_id === parentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Structure organisationnelle</h1>
          <p className="text-muted-foreground">
            Importez la structure de votre organisation et générez les tokens
            anonymes
          </p>
        </div>
      </div>

      {/* Company filter */}
      {societesList.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Filtrer par société :</Label>
          <Select value={selectedSocieteId} onValueChange={setSelectedSocieteId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Toutes les sociétés" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sociétés</SelectItem>
              {societesList.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Sociétés */}
      {societesList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Sociétés
            </CardTitle>
            <CardDescription>
              {filteredSocietes.length} société(s) — importez un logo pour chacune
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSocietes.map((soc) => (
                <div
                  key={soc.id}
                  className="flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {soc.logo_url ? (
                      <img
                        src={soc.logo_url}
                        alt={`Logo ${soc.name}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{soc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <label>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(soc.id, e)}
                          disabled={uploadingLogoId === soc.id}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          disabled={uploadingLogoId === soc.id}
                        >
                          <span className="cursor-pointer">
                            {uploadingLogoId === soc.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ImagePlus className="mr-1 h-3.5 w-3.5" />
                            )}
                            {soc.logo_url ? "Changer" : "Importer"}
                          </span>
                        </Button>
                      </label>
                      {soc.logo_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLogoDelete(soc)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSociete(soc)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer un fichier
          </CardTitle>
          <CardDescription>
            Fichier CSV ou Excel avec les colonnes : <strong>Nom</strong>,{" "}
            <strong>Email</strong>, <strong>Société</strong>,{" "}
            <strong>Direction</strong>, <strong>Département</strong>,{" "}
            <strong>Service</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <a href="/template-import-structure.xlsx" download>
              <Button variant="outline" size="sm">
                <FileDown className="mr-2 h-4 w-4" />
                Télécharger le template Excel
              </Button>
            </a>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-sm text-blue-800">
              Seules les colonnes <strong>ID Employé</strong> et <strong>Société</strong> sont
              obligatoires. Les autres colonnes (Email, Direction, Département, Service,...)
              sont facultatives. Cependant, moins vous renseignez de données, moins les
              options de filtrage des résultats seront précises.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="max-w-md"
            />
            {uploading && (
              <span className="text-sm text-muted-foreground">
                Import en cours...
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Errors */}
      {importErrors.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-5 w-5" />
              Avertissements ({importErrors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm text-orange-700">
              {importErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {summary && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Récapitulatif de l&apos;import
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.employees}
                </p>
                <p className="text-sm text-green-600">Employés</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.tokens}
                </p>
                <p className="text-sm text-green-600">Nouveaux</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.tokensUpdated}
                </p>
                <p className="text-sm text-green-600">Mis à jour</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.societes}
                </p>
                <p className="text-sm text-green-600">Sociétés</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.directions}
                </p>
                <p className="text-sm text-green-600">Directions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.departments + summary.services}
                </p>
                <p className="text-sm text-green-600">Dép./Services</p>
              </div>
            </div>
            {tokenMappings.length > 0 && (
              <div className="mt-4">
                <Button variant="outline" onClick={downloadDistributionCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger le CSV de distribution (tokens)
                </Button>
                <p className="mt-2 text-xs text-green-600">
                  Ce fichier contient le mapping email → token. Conservez-le en
                  lieu sûr, il ne sera pas stocké sur le serveur.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Structure actuelle
          </CardTitle>
          <CardDescription>
            {orgs.length} unité(s) organisationnelle(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-4 text-center">
              Chargement...
            </p>
          ) : rootNodes.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">
                Aucune structure importée. Uploadez un fichier CSV ou Excel.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Rattachement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rootNodes.map((root) => {
                    const level1Children = getChildren(root.id);
                    return (
                      <Fragment key={root.id}>
                        <TableRow>
                          <TableCell className="font-bold">
                            {root.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant={TYPE_COLORS[root.type]}>
                              {TYPE_LABELS[root.type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            —
                          </TableCell>
                        </TableRow>
                        {level1Children.map((l1) => {
                          const level2Children = getChildren(l1.id);
                          return (
                            <Fragment key={l1.id}>
                              <TableRow>
                                <TableCell className="pl-8 font-semibold">
                                  {l1.name}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={TYPE_COLORS[l1.type]}>
                                    {TYPE_LABELS[l1.type]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {root.name}
                                </TableCell>
                              </TableRow>
                              {level2Children.map((l2) => {
                                const level3Children = getChildren(l2.id);
                                return (
                                  <Fragment key={l2.id}>
                                    <TableRow>
                                      <TableCell className="pl-16">
                                        {l2.name}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={TYPE_COLORS[l2.type]}>
                                          {TYPE_LABELS[l2.type]}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {l1.name}
                                      </TableCell>
                                    </TableRow>
                                    {level3Children.map((l3) => (
                                      <TableRow key={l3.id}>
                                        <TableCell className="pl-24">
                                          {l3.name}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={TYPE_COLORS[l3.type]}>
                                            {TYPE_LABELS[l3.type]}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                          {l2.name}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </Fragment>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
