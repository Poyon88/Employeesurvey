"use client";

import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md text-center space-y-6 p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldOff className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold">Compte suspendu</h1>
        <p className="text-muted-foreground">
          Votre compte a ete suspendu par l&apos;administrateur de la plateforme.
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, veuillez nous contacter.
        </p>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" className="w-full">
            Se deconnecter
          </Button>
        </form>
      </div>
    </div>
  );
}
