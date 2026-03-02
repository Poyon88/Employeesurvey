import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const supabase = await createClient();

  // 1. Find invitation by token
  const { data: invitation, error: invError } = await supabase
    .from("tenant_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (invError || !invitation) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_invitation", request.url)
    );
  }

  // 2. Verify not expired
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.redirect(
      new URL("/login?error=invitation_expired", request.url)
    );
  }

  // 3. Verify not already accepted
  if (invitation.accepted_at) {
    return NextResponse.redirect(
      new URL("/login?error=invitation_already_accepted", request.url)
    );
  }

  // 4. Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login with a return URL
    const returnUrl = `/auth/accept-invite?token=${token}`;
    return NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(returnUrl)}`, request.url)
    );
  }

  // 5. Create tenant_member
  const { error: memberError } = await supabase
    .from("tenant_members")
    .insert({
      tenant_id: invitation.tenant_id,
      user_id: user.id,
      role: "member",
    });

  if (memberError) {
    // If already a member, just redirect
    if (memberError.code === "23505") {
      // unique_violation
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(
      new URL("/login?error=join_failed", request.url)
    );
  }

  // 6. Update invitation accepted_at
  await supabase
    .from("tenant_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  // 7. Redirect to dashboard
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
