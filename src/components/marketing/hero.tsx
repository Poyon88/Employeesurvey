import Link from "next/link";
import { BarChart3, FileText, Globe, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-blue-50/50">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
            Plateforme de sondages employés
          </Badge>

          {/* Title */}
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Mesurez l&apos;engagement de vos collaborateurs en toute simplicité
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            La plateforme complète de pulse surveys pour comprendre, analyser et
            améliorer l&apos;expérience collaborateur
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="bg-accent-blue px-8 text-white hover:bg-accent-blue-dark"
            >
              <Link href="/signup">
                Commencer l&apos;essai gratuit — 30 jours
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">Découvrir les fonctionnalités</a>
            </Button>
          </div>

          {/* Abstract visual: 4 icon cards */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-lg bg-blue-50">
                <FileText className="size-6 text-accent-blue" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Sondages IA
              </span>
            </div>
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-lg bg-blue-50">
                <BarChart3 className="size-6 text-accent-blue" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Analyses temps réel
              </span>
            </div>
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-lg bg-blue-50">
                <Globe className="size-6 text-accent-blue" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Multi-langue
              </span>
            </div>
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-lg bg-blue-50">
                <Shield className="size-6 text-accent-blue" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Anonymat garanti
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
