"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Users,
  ClipboardList,
  Trash2,
  Pause,
  Play,
  Network,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import Link from "next/link";
import {
  getTenantDetail,
  suspendTenant,
  reactivateTenant,
  deleteTenant,
  deleteSurveyAsAdmin,
  deleteOrganizationAsAdmin,
} from "../../actions";
import type { TenantDetail } from "@/lib/types/admin";

export default function AdminTenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    setLoading(true);
    try {
      const data = await getTenantDetail(tenantId);
      setTenant(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse bg-muted rounded" />
        <div className="h-64 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Tenant introuvable</p>
        <Button variant="outline" asChild>
          <Link href="/admin/tenants">Retour</Link>
        </Button>
      </div>
    );
  }

  const handleSuspend = async () => {
    if (!confirm("Suspendre ce tenant ?")) return;
    const result = await suspendTenant(tenantId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Tenant suspendu");
      fetchTenant();
    }
  };

  const handleReactivate = async () => {
    const result = await reactivateTenant(tenantId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Tenant reactive");
      fetchTenant();
    }
  };

  const handleDelete = async () => {
    if (!confirm(`ATTENTION: Supprimer definitivement "${tenant.name}" et toutes ses donnees ?`))
      return;
    if (!confirm("Cette action est IRREVERSIBLE. Confirmer ?")) return;
    const result = await deleteTenant(tenantId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Tenant supprime");
      router.push("/admin/tenants");
    }
  };

  const handleDeleteSurvey = async (surveyId: string, title: string) => {
    if (!confirm(`Supprimer le sondage "${title}" ?`)) return;
    const result = await deleteSurveyAsAdmin(surveyId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Sondage supprime");
      fetchTenant();
    }
  };

  const handleDeleteOrg = async (orgId: string, name: string) => {
    if (!confirm(`Supprimer l'organisation "${name}" ?`)) return;
    const result = await deleteOrganizationAsAdmin(orgId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Organisation supprimee");
      fetchTenant();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/tenants">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
        {tenant.suspended_at && <Badge variant="destructive">Suspendu</Badge>}
      </div>

      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span>{tenant.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cree le</span>
              <span>{new Date(tenant.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stripe ID</span>
              <span className="font-mono text-xs">{tenant.stripe_customer_id || "-"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Abonnement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {tenant.subscription ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="capitalize">{tenant.subscription.plan_tier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <span className="capitalize">{tenant.subscription.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employes declares</span>
                  <span>{tenant.subscription.declared_employees}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employes reels</span>
                  <span>{tenant.subscription.actual_employees}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Aucun abonnement</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tenant.suspended_at ? (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleReactivate}
              >
                <Play className="mr-2 h-4 w-4 text-green-600" />
                Reactiver
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleSuspend}
              >
                <Pause className="mr-2 h-4 w-4 text-orange-600" />
                Suspendre
              </Button>
            )}
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer le tenant
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Membres ({tenant.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rejoint le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenant.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.profile.email}</TableCell>
                  <TableCell>{member.profile.full_name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{member.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joined_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Surveys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Sondages ({tenant.surveys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.surveys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun sondage</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Cree le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.surveys.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell>{survey.title_fr}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{survey.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(survey.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSurvey(survey.id, survey.title_fr)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Organizations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Network className="h-4 w-4" />
            Structure organisationnelle ({tenant.organizations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune organisation</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteOrg(org.id, org.name)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
