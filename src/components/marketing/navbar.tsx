"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <BarChart3 className="size-6 text-accent-blue" />
          <span className="text-lg font-bold">PulseSurvey</span>
        </Link>

        {/* Center: Desktop nav links */}
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Fonctionnalités
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Tarifs
          </a>
        </div>

        {/* Right: Desktop auth links */}
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button asChild className="bg-accent-blue text-white hover:bg-accent-blue-dark">
            <Link href="/signup">Essai gratuit</Link>
          </Button>
        </div>

        {/* Mobile: Hamburger */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Ouvrir le menu"
        >
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t bg-white md:hidden">
          <div className="flex flex-col gap-2 px-4 py-4">
            <a
              href="#features"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Fonctionnalités
            </a>
            <a
              href="#pricing"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Tarifs
            </a>
            <hr className="my-2" />
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Se connecter
            </Link>
            <Button asChild className="bg-accent-blue text-white hover:bg-accent-blue-dark">
              <Link href="/signup" onClick={() => setMobileOpen(false)}>
                Essai gratuit
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
