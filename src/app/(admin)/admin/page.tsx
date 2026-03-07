"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, ClipboardList, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdminDashboardData } from "./actions";
import type { AdminDashboardData } from "@/lib/types/admin";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminDashboardData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    {
      title: "Tenants",
      value: data.totalTenants,
      icon: Building2,
      description: `${data.suspendedTenants} suspendu(s)`,
      href: "/admin/tenants",
    },
    {
      title: "Abonnements actifs",
      value: data.activeTenants,
      icon: TrendingUp,
      description: `${data.trialingTenants} en essai`,
      href: "/admin/tenants?status=active",
    },
    {
      title: "Utilisateurs",
      value: data.totalUsers,
      icon: Users,
      href: "/admin/users",
    },
    {
      title: "Sondages",
      value: data.totalSurveys,
      icon: ClipboardList,
      href: "/admin/tenants",
    },
  ];

  const actionLabels: Record<string, string> = {
    suspend_tenant: "Suspension",
    reactivate_tenant: "Reactivation",
    delete_tenant: "Suppression tenant",
    delete_survey: "Suppression sondage",
    delete_organization: "Suppression organisation",
    view_tenant: "Consultation",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.title} href={kpi.href}>
            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                {kpi.description && (
                  <p className="text-xs text-muted-foreground">{kpi.description}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {Object.keys(data.tenantsByPlan).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Repartition par plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {Object.entries(data.tenantsByPlan).map(([plan, count]) => (
                <div key={plan} className="text-center">
                  <div className="text-xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground capitalize">{plan}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Activite recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune activite recente</p>
          ) : (
            <div className="space-y-3">
              {data.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {log.action.includes("delete") ? (
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    ) : (
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span>{actionLabels[log.action] || log.action}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.target_type}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("fr-FR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
