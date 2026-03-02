"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PRICING_TIERS, type PlanTierKey } from "@/lib/constants";
import { completeSignup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Users,
  Mail,
  Lock,
  Sparkles,
} from "lucide-react";

function getTierForCount(count: number): PlanTierKey | null {
  for (const [key, tier] of Object.entries(PRICING_TIERS)) {
    if (count >= tier.min && count <= tier.max) {
      return key as PlanTierKey;
    }
  }
  return null;
}

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [employeeCount, setEmployeeCount] = useState<number>(10);
  const [selectedTier, setSelectedTier] = useState<PlanTierKey>("starter");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Step 1: Account creation
  async function handleAccountCreation(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Mot de passe trop court", {
        description: "Le mot de passe doit contenir au moins 8 caractères.",
      });
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      toast.error("Erreur lors de la création du compte", {
        description: error.message,
      });
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep(2);
  }

  // Step 2: Update tier based on employee count
  function handleEmployeeCountChange(value: number) {
    setEmployeeCount(value);
    const tier = getTierForCount(value);
    if (tier) {
      setSelectedTier(tier);
    }
  }

  // Step 3: Complete signup
  async function handleCompleteSignup() {
    setLoading(true);

    const result = await completeSignup({
      companyName,
      planTier: selectedTier,
      declaredEmployees: employeeCount,
    });

    if (result.error) {
      toast.error("Erreur lors de la finalisation", {
        description: result.error,
      });
      setLoading(false);
      return;
    }

    toast.success("Bienvenue sur PulseSurvey !", {
      description: "Votre essai gratuit de 30 jours a commencé.",
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-8">
      <div className="w-full max-w-4xl">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  s <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span
                className={`hidden text-sm sm:inline ${
                  s <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s === 1 ? "Compte" : s === 2 ? "Plan" : "Confirmation"}
              </span>
              {s < 3 && (
                <div
                  className={`mx-2 h-px w-8 ${
                    s < step ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Account */}
        {step === 1 && (
          <Card className="mx-auto w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">
                Créer votre compte
              </CardTitle>
              <CardDescription>
                Commencez avec PulseSurvey en quelques minutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAccountCreation} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Nom de l&apos;entreprise</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="company"
                      type="text"
                      placeholder="Ma Société SAS"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email professionnel</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@entreprise.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minimum 8 caractères"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      minLength={8}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 caractères
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    "Création en cours..."
                  ) : (
                    <>
                      Continuer <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Vous avez déjà un compte ?{" "}
                <Link href="/login" className="text-primary underline">
                  Se connecter
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Choisissez votre plan</h2>
              <p className="mt-1 text-muted-foreground">
                30 jours d&apos;essai gratuit, sans engagement
              </p>
            </div>

            <div className="mx-auto max-w-xs space-y-2">
              <Label htmlFor="employees">Nombre d&apos;employés déclarés</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="employees"
                  type="number"
                  min={1}
                  value={employeeCount}
                  onChange={(e) =>
                    handleEmployeeCountChange(parseInt(e.target.value) || 1)
                  }
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                Object.entries(PRICING_TIERS) as [
                  PlanTierKey,
                  (typeof PRICING_TIERS)[PlanTierKey],
                ][]
              ).map(([key, tier]) => {
                const isSelected = selectedTier === key;
                const isEnterprise = key === "enterprise";

                return (
                  <Card
                    key={key}
                    className={`relative cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "hover:border-foreground/20"
                    }`}
                    onClick={() => {
                      setSelectedTier(key);
                      if (employeeCount < tier.min) {
                        setEmployeeCount(tier.min);
                      } else if (employeeCount > tier.max) {
                        setEmployeeCount(tier.max === Infinity ? tier.min : tier.max);
                      }
                    }}
                  >
                    {isSelected && (
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                        Sélectionné
                      </Badge>
                    )}
                    <CardHeader className="pb-2 text-center">
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                      <CardDescription>
                        {tier.min === tier.max
                          ? `${tier.min} employés`
                          : tier.max === Infinity
                            ? `${tier.min}+ employés`
                            : `${tier.min}-${tier.max} employés`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                      {isEnterprise ? (
                        <div>
                          <p className="text-2xl font-bold">Sur mesure</p>
                          <p className="text-sm text-muted-foreground">
                            Contactez-nous
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-2xl font-bold">
                            {tier.display}&euro;
                          </p>
                          <p className="text-sm text-muted-foreground">
                            par mois
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour
              </Button>
              <Button onClick={() => setStep(3)}>
                Continuer <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <Card className="mx-auto w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">
                Récapitulatif
              </CardTitle>
              <CardDescription>
                Vérifiez vos informations avant de démarrer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Entreprise
                  </span>
                  <span className="font-medium">{companyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="font-medium">{email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Badge variant="secondary">
                    {PRICING_TIERS[selectedTier].name}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Employés déclarés
                  </span>
                  <span className="font-medium">{employeeCount}</span>
                </div>
                {PRICING_TIERS[selectedTier].display && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm font-medium">
                      Après l&apos;essai gratuit
                    </span>
                    <span className="font-bold">
                      {PRICING_TIERS[selectedTier].display}&euro;/mois
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  onClick={handleCompleteSignup}
                  disabled={loading}
                >
                  {loading ? (
                    "Finalisation..."
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Démarrer l&apos;essai gratuit de 30 jours
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
