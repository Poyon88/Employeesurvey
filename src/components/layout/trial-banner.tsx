"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TrialBanner() {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    async function checkTrial() {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        // Get tenant membership
        const { data: membership } = await supabase
          .from("tenant_members")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (!membership) return;

        // Get subscription
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("status, trial_ends_at")
          .eq("tenant_id", membership.tenant_id)
          .single();

        if (!subscription) return;

        if (
          subscription.status === "trialing" &&
          subscription.trial_ends_at
        ) {
          const days = Math.ceil(
            (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          );

          if (days > 0 && days < 7) {
            setDaysRemaining(days);
          }
        }
      } catch (error) {
        console.error("TrialBanner error:", error);
      }
    }

    checkTrial();
  }, []);

  if (daysRemaining === null) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 border-b border-amber-200">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Votre essai gratuit expire dans{" "}
        <strong>
          {daysRemaining} jour{daysRemaining > 1 ? "s" : ""}
        </strong>
        .
      </span>
      <Link
        href="/settings/billing"
        className="font-medium underline underline-offset-2 hover:text-amber-900"
      >
        Souscrire maintenant
      </Link>
    </div>
  );
}
