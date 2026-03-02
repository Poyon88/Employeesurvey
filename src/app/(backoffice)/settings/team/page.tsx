"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  UserPlus,
  Trash2,
  X,
  Mail,
  Shield,
  User,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamData } from "./actions";
import {
  getTeamData,
  inviteMember,
  removeMember,
  cancelInvitation,
} from "./actions";

const settingsTabs = [
  { label: "General", href: "/settings" },
  { label: "Abonnement", href: "/settings/billing" },
  { label: "Equipe", href: "/settings/team" },
];

export default function TeamPage() {
  const pathname = usePathname();
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const result = await getTeamData();
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setData(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      const result = await inviteMember(inviteEmail.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Invitation envoyee avec succes !");
        setInviteEmail("");
        fetchData();
      }
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setInviting(false);
    }
  };

  const onRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      const result = await removeMember(memberId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Membre supprime avec succes.");
        fetchData();
      }
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setRemovingId(null);
    }
  };

  const onCancelInvitation = async (invitationId: string) => {
    setCancelingId(invitationId);
    try {
      const result = await cancelInvitation(invitationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Invitation annulee.");
        fetchData();
      }
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setCancelingId(null);
    }
  };

  const truncateUserId = (id: string) => {
    return id.length > 8 ? `${id.substring(0, 8)}...` : id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parametres</h1>
        <p className="text-muted-foreground">
          Gerez votre compte et votre equipe
        </p>
      </div>

      {/* Tab navigation */}
      <nav className="flex gap-4 border-b">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2 text-sm font-medium transition-colors ${
              pathname === tab.href
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              Impossible de charger les donnees de l&apos;equipe.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Members table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Membres de l&apos;equipe
              </CardTitle>
              <CardDescription>
                {data.members.length} membre{data.members.length > 1 ? "s" : ""}{" "}
                dans votre organisation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Date d&apos;adhesion</TableHead>
                    {data.isOwner && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono text-sm">
                        {truncateUserId(member.user_id)}
                        {member.user_id === data.currentUserId && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Vous
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.role === "owner" ? "default" : "secondary"}
                          className="gap-1"
                        >
                          {member.role === "owner" ? (
                            <>
                              <Shield className="h-3 w-3" />
                              Proprietaire
                            </>
                          ) : (
                            "Membre"
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(member.joined_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </TableCell>
                      {data.isOwner && (
                        <TableCell className="text-right">
                          {member.user_id !== data.currentUserId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveMember(member.id)}
                              disabled={removingId === member.id}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Invite member (owner only) */}
          {data.isOwner && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Inviter un membre
                </CardTitle>
                <CardDescription>
                  Envoyez une invitation par email pour ajouter un nouveau membre
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onInvite} className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="invite-email">Adresse email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="collegue@entreprise.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={inviting}>
                    <Mail className="mr-2 h-4 w-4" />
                    {inviting ? "Envoi..." : "Inviter"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Pending invitations */}
          {data.invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Invitations en attente
                </CardTitle>
                <CardDescription>
                  {data.invitations.length} invitation
                  {data.invitations.length > 1 ? "s" : ""} en cours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Date d&apos;envoi</TableHead>
                      <TableHead>Expire le</TableHead>
                      {data.isOwner && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          {new Date(invitation.created_at).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.expires_at).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        {data.isOwner && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onCancelInvitation(invitation.id)}
                              disabled={cancelingId === invitation.id}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="mr-1 h-4 w-4" />
                              Annuler
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
