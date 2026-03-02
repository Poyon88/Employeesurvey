"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  ExternalLink,
  AlertTriangle,
  Crown,
  Users,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PRICING_TIERS } from "@/lib/constants";
import type { SubscriptionData } from "./actions";
import { getSubscriptionData, handleCheckout, handleBillingPortal } from "./actions";

const settingsTabs = [
  { label: "General", href: "/settings" },
  { label: "Abonnement", href: "/settings/billing" },
  { label: "Equipe", href: "/settings/team" },
];

const STATUS_COLORS: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  past_due: "bg-red-100 text-red-800",
  canceled: "bg-gray-100 text-gray-800",
  unpaid: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Essai gratuit",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annule",
  unpaid: "Impaye",
};

function BillingContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const result = await getSubscriptionData();
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setData(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Abonnement active avec succes !");
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Paiement annule.");
    }
  }, [searchParams]);

  const onCheckout = async (planTier: string) => {
    setCheckoutLoading(true);
    try {
      const result = await handleCheckout(planTier);
      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const onBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const result = await handleBillingPortal();
      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setPortalLoading(false);
    }
  };

  // Trial calculations
  const trialDaysRemaining =
    data?.subscription?.status === "trialing" && data.subscription.trial_ends_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(data.subscription.trial_ends_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  const trialProgress =
    trialDaysRemaining !== null && data?.subscription?.trial_ends_at
      ? Math.max(
          0,
          Math.min(
            100,
            ((30 - trialDaysRemaining) / 30) * 100
          )
        )
      : 0;

  const isTrialExpired =
    data?.subscription?.status === "trialing" && trialDaysRemaining === 0;
  const isCanceled = data?.subscription?.status === "canceled";
  const needsSubscription = isTrialExpired || isCanceled;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Parametres</h1>
          <p className="text-muted-foreground">
            Gerez votre compte et votre abonnement
          </p>
        </div>
        <nav className="flex gap-4 border-b">
          {settingsTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pb-2 text-sm font-medium transition-colors ${
                pathname === tab.href
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Parametres</h1>
          <p className="text-muted-foreground">
            Gerez votre compte et votre abonnement
          </p>
        </div>
        <nav className="flex gap-4 border-b">
          {settingsTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pb-2 text-sm font-medium transition-colors ${
                pathname === tab.href
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              Impossible de charger les donnees d&apos;abonnement.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subscription, planName, maxEmployees } = data;
  const employeePercent =
    maxEmployees > 0
      ? Math.min(100, (subscription.actual_employees / maxEmployees) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parametres</h1>
        <p className="text-muted-foreground">
          Gerez votre compte et votre abonnement
        </p>
      </div>

      {/* Tab navigation */}
      <nav className="flex gap-4 border-b">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2 text-sm font-medium transition-colors ${
              pathname === tab.href
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Prominent CTA if trial expired or canceled */}
      {needsSubscription && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold text-amber-900">
                {isTrialExpired
                  ? "Votre essai gratuit a expire"
                  : "Votre abonnement est annule"}
              </h3>
              <p className="text-sm text-amber-700">
                Souscrivez a un abonnement pour continuer a utiliser PulseSurvey.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => onCheckout(subscription.plan_tier)}
              disabled={checkoutLoading}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {checkoutLoading ? "Redirection..." : "Souscrire maintenant"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Plan actuel
              </CardTitle>
              <CardDescription>
                Details de votre abonnement en cours
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {planName}
              </Badge>
              <Badge
                className={
                  STATUS_COLORS[subscription.status] ?? "bg-gray-100 text-gray-800"
                }
              >
                {STATUS_LABELS[subscription.status] ?? subscription.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trial countdown */}
          {subscription.status === "trialing" &&
            trialDaysRemaining !== null &&
            trialDaysRemaining > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">
                    {trialDaysRemaining} jours restants
                  </span>
                </div>
                <Progress value={trialProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Votre essai gratuit se termine le{" "}
                  {new Date(subscription.trial_ends_at!).toLocaleDateString(
                    "fr-FR",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }
                  )}
                </p>
              </div>
            )}

          <Separator />

          {/* Employee counter */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Employes</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>
                {subscription.actual_employees} / {maxEmployees === Infinity ? "\u221E" : maxEmployees} employes
              </span>
              <span className="text-muted-foreground">
                {maxEmployees !== Infinity
                  ? `${Math.round(employeePercent)}%`
                  : ""}
              </span>
            </div>
            {maxEmployees !== Infinity && (
              <Progress
                value={employeePercent}
                className="h-2"
                indicatorColor={employeePercent > 90 ? "#ef4444" : undefined}
              />
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => onCheckout(subscription.plan_tier)}
              disabled={checkoutLoading}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {checkoutLoading ? "Redirection..." : "Changer de plan"}
            </Button>
            {subscription.stripe_subscription_id && (
              <Button
                variant="outline"
                onClick={onBillingPortal}
                disabled={portalLoading}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {portalLoading ? "Ouverture..." : "Gerer l'abonnement"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Plans disponibles</CardTitle>
          <CardDescription>
            Comparez les plans et choisissez celui qui vous convient
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(
              Object.entries(PRICING_TIERS).filter(
                ([key]) => key !== "enterprise"
              ) as [string, (typeof PRICING_TIERS)[keyof typeof PRICING_TIERS]][]
            ).map(([key, tier]) => {
              const isCurrent = subscription.plan_tier === key;
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-4 ${
                    isCurrent ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold">{tier.name}</h4>
                    {isCurrent && (
                      <Badge variant="default" className="text-xs">
                        Actuel
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold">
                    {tier.display} &euro;
                    <span className="text-sm font-normal text-muted-foreground">
                      /mois
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tier.min} - {tier.max === Infinity ? "+" : tier.max}{" "}
                    employes
                  </p>
                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => onCheckout(key)}
                      disabled={checkoutLoading}
                    >
                      Choisir ce plan
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
