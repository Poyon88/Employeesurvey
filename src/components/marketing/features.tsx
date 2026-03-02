import { BarChart3, FileText, Globe, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileText,
    title: "Création de sondages intelligente",
    description:
      "Créez vos questionnaires ou importez-les depuis vos documents grâce à l'IA intégrée.",
  },
  {
    icon: BarChart3,
    title: "Analyses en temps réel",
    description:
      "Visualisez les résultats, suivez les tendances et identifiez les points d'amélioration.",
  },
  {
    icon: Globe,
    title: "Multi-langue",
    description:
      "Diffusez vos sondages en 11 langues avec traduction automatique intégrée.",
  },
  {
    icon: Shield,
    title: "Anonymat garanti",
    description:
      "Réponses 100% anonymes avec système de tokens sécurisé pour une confiance totale.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tout ce dont vous avez besoin
          </h2>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="border bg-white shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col items-start gap-4 pt-6">
                <div className="flex size-12 items-center justify-center rounded-lg bg-blue-50">
                  <feature.icon className="size-6 text-accent-blue" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
