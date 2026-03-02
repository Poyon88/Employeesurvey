import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PRICING_TIERS } from "@/lib/constants";

const tiers = [
  {
    key: "starter" as const,
    features: [
      "Sondages illimités",
      "Analyses en temps réel",
      "Anonymat garanti",
      "Support email",
    ],
    highlighted: false,
  },
  {
    key: "pro" as const,
    features: [
      "Sondages illimités",
      "Analyses en temps réel",
      "Anonymat garanti",
      "Support email",
      "Multi-langue",
      "Import IA",
    ],
    highlighted: true,
  },
  {
    key: "business" as const,
    features: [
      "Sondages illimités",
      "Analyses en temps réel",
      "Anonymat garanti",
      "Support email",
      "Multi-langue",
      "Import IA",
      "API access",
    ],
    highlighted: false,
  },
  {
    key: "enterprise" as const,
    features: [
      "Sondages illimités",
      "Analyses en temps réel",
      "Anonymat garanti",
      "Support email",
      "Multi-langue",
      "Import IA",
      "API access",
      "Support dédié",
    ],
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Des tarifs simples et transparents
          </h2>
        </div>

        {/* Pricing cards */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => {
            const plan = PRICING_TIERS[tier.key];
            const isEnterprise = tier.key === "enterprise";

            return (
              <Card
                key={tier.key}
                className={`relative flex flex-col ${
                  tier.highlighted
                    ? "border-accent-blue ring-2 ring-accent-blue/20 shadow-lg"
                    : "border shadow-sm"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-accent-blue text-white">
                      Populaire
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.min.toLocaleString("fr-FR")} -{" "}
                    {isEnterprise
                      ? "5 000+"
                      : plan.max.toLocaleString("fr-FR")}{" "}
                    employés
                  </p>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-6">
                  {/* Price */}
                  <div className="text-center">
                    {isEnterprise ? (
                      <span className="text-2xl font-bold text-foreground">
                        Sur mesure
                      </span>
                    ) : (
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-foreground">
                          {plan.display}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          €/mois
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="flex flex-col gap-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent-blue" />
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    asChild
                    className={`w-full ${
                      tier.highlighted
                        ? "bg-accent-blue text-white hover:bg-accent-blue-dark"
                        : ""
                    }`}
                    variant={tier.highlighted ? "default" : "outline"}
                  >
                    <Link href="/signup">
                      {isEnterprise ? "Nous contacter" : "Commencer l'essai gratuit"}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
