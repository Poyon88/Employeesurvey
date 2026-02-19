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
import {
  Upload,
  Download,
  Building2,
  Users,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

type OrgUnit = {
  id: string;
  name: string;
  type: "societe" | "direction" | "department" | "service";
  parent_id: string | null;
  created_at: string;
};

type ImportSummary = {
  employees: number;
  societes: number;
  directions: number;
  departments: number;
  services: number;
  tokens: number;
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
          description: `${data.summary.employees} employés importés, ${data.summary.tokens} tokens générés`,
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

  // Build hierarchy for display
  const societesList = orgs.filter((o) => o.type === "societe");
  const directions = orgs.filter((o) => o.type === "direction");
  const rootNodes = societesList.length > 0 ? societesList : directions;
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
        <CardContent>
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.employees}
                </p>
                <p className="text-sm text-green-600">Employés</p>
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
                  {summary.departments}
                </p>
                <p className="text-sm text-green-600">Départements</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.services}
                </p>
                <p className="text-sm text-green-600">Services</p>
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
