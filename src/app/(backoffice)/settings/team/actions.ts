"use server";

import { createClient } from "@/lib/supabase/server";
import type { TenantMember, TenantInvitation } from "@/lib/types/database";
import { randomUUID } from "crypto";

export interface TeamData {
  members: TenantMember[];
  invitations: TenantInvitation[];
  currentUserId: string;
  isOwner: boolean;
}

export async function getTeamData(): Promise<{
  data?: TeamData;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Utilisateur non authentifie." };
    }

    // Get tenant membership
    const { data: membership, error: memberError } = await supabase
      .from("tenant_members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      return { error: "Aucune organisation trouvee." };
    }

    // Fetch all members for this tenant
    const { data: members, error: membersError } = await supabase
      .from("tenant_members")
      .select("*")
      .eq("tenant_id", membership.tenant_id)
      .order("joined_at", { ascending: true });

    if (membersError) {
      return { error: "Erreur lors du chargement des membres." };
    }

    // Fetch pending invitations
    const { data: invitations, error: invError } = await supabase
      .from("tenant_invitations")
      .select("*")
      .eq("tenant_id", membership.tenant_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (invError) {
      return { error: "Erreur lors du chargement des invitations." };
    }

    return {
      data: {
        members: members ?? [],
        invitations: invitations ?? [],
        currentUserId: user.id,
        isOwner: membership.role === "owner",
      },
    };
  } catch (error) {
    console.error("getTeamData error:", error);
    return { error: "Une erreur est survenue." };
  }
}

export async function inviteMember(email: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Utilisateur non authentifie." };
    }

    // Verify owner role
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "owner") {
      return { error: "Seul le proprietaire peut inviter des membres." };
    }

    // Check if already invited
    const { data: existing } = await supabase
      .from("tenant_invitations")
      .select("id")
      .eq("tenant_id", membership.tenant_id)
      .eq("email", email)
      .is("accepted_at", null)
      .single();

    if (existing) {
      return { error: "Une invitation est deja en cours pour cet email." };
    }

    // Create invitation
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const { error: insertError } = await supabase
      .from("tenant_invitations")
      .insert({
        tenant_id: membership.tenant_id,
        email,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      return { error: `Erreur lors de l'envoi de l'invitation : ${insertError.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error("inviteMember error:", error);
    return { error: "Une erreur est survenue." };
  }
}

export async function removeMember(memberId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Utilisateur non authentifie." };
    }

    // Verify owner role
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "owner") {
      return { error: "Seul le proprietaire peut supprimer des membres." };
    }

    // Cannot remove self
    const { data: targetMember } = await supabase
      .from("tenant_members")
      .select("*")
      .eq("id", memberId)
      .single();

    if (!targetMember) {
      return { error: "Membre introuvable." };
    }

    if (targetMember.user_id === user.id) {
      return { error: "Vous ne pouvez pas vous supprimer vous-meme." };
    }

    // Verify same tenant
    if (targetMember.tenant_id !== membership.tenant_id) {
      return { error: "Ce membre n'appartient pas a votre organisation." };
    }

    const { error: deleteError } = await supabase
      .from("tenant_members")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      return { error: `Erreur lors de la suppression : ${deleteError.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error("removeMember error:", error);
    return { error: "Une erreur est survenue." };
  }
}

export async function cancelInvitation(invitationId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Utilisateur non authentifie." };
    }

    // Verify owner role
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "owner") {
      return { error: "Seul le proprietaire peut annuler des invitations." };
    }

    // Verify invitation belongs to same tenant
    const { data: invitation } = await supabase
      .from("tenant_invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (!invitation || invitation.tenant_id !== membership.tenant_id) {
      return { error: "Invitation introuvable." };
    }

    const { error: deleteError } = await supabase
      .from("tenant_invitations")
      .delete()
      .eq("id", invitationId);

    if (deleteError) {
      return { error: `Erreur lors de l'annulation : ${deleteError.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error("cancelInvitation error:", error);
    return { error: "Une erreur est survenue." };
  }
}
