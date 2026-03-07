"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Pause, Play, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getTenantsWithDetails, suspendTenant, reactivateTenant } from "../actions";
import type { TenantWithDetails } from "@/lib/types/admin";

export default function AdminTenantsPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "all";

  const [tenants, setTenants] = useState<TenantWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTenantsWithDetails(
        search || undefined,
        statusFilter === "all" ? undefined : statusFilter,
        page
      );
      setTenants(result.tenants);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleSuspend = async (tenantId: string) => {
    if (!confirm("Suspendre ce tenant ? Ses utilisateurs ne pourront plus acceder a la plateforme.")) return;
    const result = await suspendTenant(tenantId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Tenant suspendu");
      fetchTenants();
    }
  };

  const handleReactivate = async (tenantId: string) => {
    const result = await reactivateTenant(tenantId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Tenant reactive");
      fetchTenants();
    }
  };

  const statusBadge = (tenant: TenantWithDetails) => {
    if (tenant.suspended_at) {
      return <Badge variant="destructive">Suspendu</Badge>;
    }
    if (!tenant.subscription) {
      return <Badge variant="secondary">Sans abonnement</Badge>;
    }
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      active: { label: "Actif", variant: "default" },
      trialing: { label: "Essai", variant: "outline" },
      past_due: { label: "Impaye", variant: "secondary" },
      canceled: { label: "Annule", variant: "secondary" },
      unpaid: { label: "Non paye", variant: "secondary" },
    };
    const s = statusMap[tenant.subscription.status] || { label: tenant.subscription.status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tenants</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {total} tenant(s) au total
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou slug..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="suspended">Suspendus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Membres</TableHead>
                  <TableHead className="text-right">Sondages</TableHead>
                  <TableHead>Cree le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Aucun tenant trouve
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {tenant.subscription?.plan_tier || "-"}
                        </span>
                      </TableCell>
                      <TableCell>{statusBadge(tenant)}</TableCell>
                      <TableCell className="text-right">{tenant.memberCount}</TableCell>
                      <TableCell className="text-right">{tenant.surveyCount}</TableCell>
                      <TableCell>
                        {new Date(tenant.created_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/tenants/${tenant.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {tenant.suspended_at ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReactivate(tenant.id)}
                              title="Reactiver"
                            >
                              <Play className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSuspend(tenant.id)}
                              title="Suspendre"
                            >
                              <Pause className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Precedent
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
