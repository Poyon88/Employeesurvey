"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
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
  Loader2,
  Trash2,
  Plus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

type OrgUnit = {
  id: string;
  name: string;
  type: "societe" | "direction" | "department" | "service";
  parent_id: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  created_at: string;
};

type ImportSummary = {
  employees: number;
  directions: number;
  departments: number;
  services: number;
  tokens: number;
  tokensUpdated: number;
  tokensDeactivated: number;
};

type TokenMapping = {
  employee_id: string;
  email: string;
  nom: string;
  token: string;
  direction: string;
  departement: string;
  service: string;
};

const TYPE_LABELS: Record<string, string> = {
  societe: "Societe",
  direction: "Direction",
  department: "Departement",
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
  const [importSocieteId, setImportSocieteId] = useState<string>("");
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

    if (!importSocieteId) {
      toast.error("Veuillez selectionner une societe avant d'importer");
      e.target.value = "";
      return;
    }

    const validTypes = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      toast.error("Format non supporte. Utilisez CSV ou Excel (.xlsx).");
      return;
    }

    setUploading(true);
    setImportErrors([]);
    setSummary(null);
    setTokenMappings([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("societe_id", importSocieteId);

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
        toast.success("Import reussi", {
          description: `${data.summary.employees} employes traites — ${data.summary.tokens} nouveaux tokens, ${data.summary.tokensUpdated} mis a jour`,
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

    const header = "ID Employe,Email,Nom,Token,Direction,Departement,Service";
    const rows = tokenMappings.map(
      (t) =>
        `${t.employee_id},${t.email},${t.nom},${t.token},${t.direction},${t.departement},${t.service}`
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

  async function handleDeleteSociete(societe: OrgUnit) {
    const confirmed = confirm(
      `Supprimer la societe "${societe.name}" ?\n\n` +
        `ATTENTION : Cette action est irreversible.\n\n` +
        `Toutes les informations liees a cette societe seront definitivement supprimees :\n` +
        `- Structure organisationnelle (directions, departements, services)\n` +
        `- Employes et tokens anonymes\n` +
        `- Sondages associes et leurs reponses\n` +
        `- Logo de la societe`
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
        toast.success(`Societe "${societe.name}" supprimee`);
        loadOrgs();
      }
    } catch {
      toast.error("Erreur reseau lors de la suppression");
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
            Importez la structure de votre organisation et generez les tokens
            anonymes
          </p>
        </div>
      </div>

      {/* Company filter */}
      {societesList.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Filtrer par societe :</Label>
          <Select value={selectedSocieteId} onValueChange={setSelectedSocieteId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Toutes les societes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les societes</SelectItem>
              {societesList.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Societes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Societes
              </CardTitle>
              <CardDescription>
                {societesList.length} societe(s) enregistree(s)
              </CardDescription>
            </div>
            <Link href="/org-structure/societes/new">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Creer une societe
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {societesList.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">
                Aucune societe. Creez-en une pour commencer l&apos;import.
              </p>
            </div>
          ) : (
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
                    {/* Color swatches + font */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {soc.primary_color && (
                        <div
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: soc.primary_color }}
                          title={`Primaire: ${soc.primary_color}`}
                        />
                      )}
                      {soc.secondary_color && (
                        <div
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: soc.secondary_color }}
                          title={`Secondaire: ${soc.secondary_color}`}
                        />
                      )}
                      {soc.accent_color && (
                        <div
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: soc.accent_color }}
                          title={`Accent: ${soc.accent_color}`}
                        />
                      )}
                      {soc.font_family && (
                        <span className="text-xs text-muted-foreground ml-1 truncate">
                          {soc.font_family}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Link href={`/org-structure/societes/${soc.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Modifier
                        </Button>
                      </Link>
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
          )}
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer un fichier
          </CardTitle>
          <CardDescription>
            Fichier CSV ou Excel avec la colonne obligatoire : <strong>ID Employe</strong>.
            Colonnes optionnelles : Nom, Email, Direction, Departement, Service, Sexe, Date de naissance, Date d&apos;entree, Fonction, Lieu de travail, Type de contrat, Temps de travail, Cost center.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <a href="/template-import-structure.xlsx" download>
              <Button variant="outline" size="sm">
                <FileDown className="mr-2 h-4 w-4" />
                Telecharger le template Excel
              </Button>
            </a>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-sm text-blue-800">
              Seule la colonne <strong>ID Employe</strong> est obligatoire.
              Les autres colonnes (Nom, Email, Direction, Departement, Service, Sexe, Date de naissance, Date d&apos;entree, Fonction, Lieu de travail, Type de contrat, Temps de travail, Cost center)
              sont facultatives. Selectionnez une societe ci-dessous avant d&apos;importer.
            </p>
          </div>

          {/* Societe selector for import */}
          <div className="space-y-2">
            <Label htmlFor="import-societe">Societe *</Label>
            <Select value={importSocieteId} onValueChange={setImportSocieteId}>
              <SelectTrigger id="import-societe" className="max-w-md">
                <SelectValue placeholder="Selectionnez une societe" />
              </SelectTrigger>
              <SelectContent>
                {societesList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading || !importSocieteId}
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
              Recapitulatif de l&apos;import
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.employees}
                </p>
                <p className="text-sm text-green-600">Employes</p>
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
                <p className="text-sm text-green-600">Mis a jour</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {summary.tokensDeactivated}
                </p>
                <p className="text-sm text-orange-500">Desactives</p>
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
                <p className="text-sm text-green-600">Dep./Services</p>
              </div>
            </div>
            {tokenMappings.length > 0 && (
              <div className="mt-4">
                <Button variant="outline" onClick={downloadDistributionCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Telecharger le CSV de distribution (tokens)
                </Button>
                <p className="mt-2 text-xs text-green-600">
                  Ce fichier contient le mapping email &rarr; token. Conservez-le en
                  lieu sur, il ne sera pas stocke sur le serveur.
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
            {orgs.length} unite(s) organisationnelle(s)
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
                Aucune structure importee. Creez une societe puis uploadez un fichier.
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
