import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/reset-password", "/s/", "/thank-you", "/auth/", "/api/surveys/", "/api/stripe/webhook", "/suspended"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes: always accessible
  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  // Not authenticated → redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Admin routes: check is_platform_admin
  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_platform_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Platform admins skip tenant/subscription checks for /admin routes
    return supabaseResponse;
  }

  // Check if user has a tenant
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  // No tenant → redirect to signup plan step (except if already on signup)
  if (!membership) {
    if (pathname.startsWith("/signup")) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.set("step", "plan");
    return NextResponse.redirect(url);
  }

  // Check if tenant is suspended
  const { data: tenant } = await supabase
    .from("tenants")
    .select("suspended_at")
    .eq("id", membership.tenant_id)
    .single();

  if (tenant?.suspended_at) {
    if (pathname === "/suspended") return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/suspended";
    return NextResponse.redirect(url);
  }

  // Check subscription status
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("tenant_id", membership.tenant_id)
    .single();

  if (subscription) {
    const isTrialExpired =
      subscription.status === "trialing" &&
      subscription.trial_ends_at &&
      new Date(subscription.trial_ends_at) < new Date();

    const isInactive = ["canceled", "unpaid"].includes(subscription.status);

    // Trial expired or inactive → redirect to billing (allow settings pages)
    if ((isTrialExpired || isInactive) && !pathname.startsWith("/settings")) {
      const url = request.nextUrl.clone();
      url.pathname = "/settings/billing";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
