"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { User, Mail, KeyRound, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

const settingsTabs = [
  { label: "General", href: "/settings" },
  { label: "Abonnement", href: "/settings/billing" },
  { label: "Equipe", href: "/settings/team" },
];

export default function SettingsPage() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? null);
      }
      setLoading(false);
    }
    fetchUser();
  }, []);

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(`Erreur : ${error.message}`);
      } else {
        toast.success("Mot de passe modifie avec succes !");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parametres</h1>
        <p className="text-muted-foreground">
          Gerez votre compte et vos preferences
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
      ) : (
        <>
          {/* Profile info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informations du profil
              </CardTitle>
              <CardDescription>
                Vos informations de compte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Adresse email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{email ?? "Non disponible"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Changer le mot de passe
              </CardTitle>
              <CardDescription>
                Mettez a jour votre mot de passe de connexion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Au moins 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">
                    Confirmer le mot de passe
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repetez le mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" disabled={changingPassword}>
                  {changingPassword ? "Modification..." : "Modifier le mot de passe"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Separator />

          {/* Sign out */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                Deconnexion
              </CardTitle>
              <CardDescription>
                Deconnectez-vous de votre compte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action="/auth/signout" method="post">
                <Button variant="destructive" type="submit">
                  <LogOut className="mr-2 h-4 w-4" />
                  Se deconnecter
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
