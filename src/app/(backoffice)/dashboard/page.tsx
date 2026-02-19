"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Users, BarChart3, Building2 } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    activeSurveys: 0,
    totalResponses: 0,
    totalTokens: 0,
    users: 0,
    orgs: 0,
  });

  const loadStats = useCallback(async () => {
    const [surveysRes, responsesRes, tokensRes, usersRes, orgsRes] =
      await Promise.all([
        supabase
          .from("surveys")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
        supabase
          .from("responses")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("anonymous_tokens")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("organizations")
          .select("id", { count: "exact", head: true }),
      ]);

    setStats({
      activeSurveys: surveysRes.count || 0,
      totalResponses: responsesRes.count || 0,
      totalTokens: tokensRes.count || 0,
      users: usersRes.count || 0,
      orgs: orgsRes.count || 0,
    });
  }, [supabase]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const responseRate =
    stats.totalTokens > 0
      ? Math.round((stats.totalResponses / stats.totalTokens) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble de votre plateforme PulseSurvey
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/surveys" className="transition-shadow hover:shadow-md rounded-xl">
          <Card className="cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Sondages actifs
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSurveys}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeSurveys === 0
                  ? "Aucun sondage actif"
                  : "sondage(s) en cours"}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/surveys" className="transition-shadow hover:shadow-md rounded-xl">
          <Card className="cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Taux de réponse global
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {responseRate !== null ? `${responseRate}%` : "--%"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalResponses} réponse(s) / {stats.totalTokens} token(s)
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/users" className="transition-shadow hover:shadow-md rounded-xl">
          <Card className="cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.users}</div>
              <p className="text-xs text-muted-foreground">
                utilisateur(s) backoffice
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/org-structure" className="transition-shadow hover:shadow-md rounded-xl">
          <Card className="cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Unités organisationnelles
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.orgs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.orgs === 0
                  ? "Structure non importée"
                  : "direction(s), département(s), service(s)"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
