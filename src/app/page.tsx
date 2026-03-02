import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Pricing } from "@/components/marketing/pricing";
import { Footer } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Pricing />

        {/* Final CTA Section */}
        <section className="bg-accent-blue py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Prêt à transformer l&apos;écoute collaborateur ?
            </h2>
            <p className="mt-4 text-lg text-blue-100">
              30 jours d&apos;essai gratuit
            </p>
            <div className="mt-10">
              <Button
                size="lg"
                asChild
                className="bg-white px-8 text-accent-blue hover:bg-blue-50"
              >
                <Link href="/signup">
                  Commencer l&apos;essai gratuit
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
