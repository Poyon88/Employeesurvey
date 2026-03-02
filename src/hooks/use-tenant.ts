"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tenant, TenantMember, Subscription } from "@/lib/types/database";

interface UseTenantReturn {
  tenant: Tenant | null;
  subscription: Subscription | null;
  membership: TenantMember | null;
  loading: boolean;
}

export function useTenant(): UseTenantReturn {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [membership, setMembership] = useState<TenantMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTenantData() {
      try {
        const supabase = createClient();

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        // Get tenant membership
        const { data: member, error: memberError } = await supabase
          .from("tenant_members")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (memberError || !member) {
          setLoading(false);
          return;
        }

        setMembership(member);

        // Fetch tenant
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", member.tenant_id)
          .single();

        if (tenantData) {
          setTenant(tenantData);
        }

        // Fetch subscription
        const { data: subscriptionData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("tenant_id", member.tenant_id)
          .single();

        if (subscriptionData) {
          setSubscription(subscriptionData);
        }
      } catch (error) {
        console.error("Error fetching tenant data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTenantData();
  }, []);

  return { tenant, subscription, membership, loading };
}
