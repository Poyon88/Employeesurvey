"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "hr_management" | "manager";
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  hr_management: "RH / Direction",
  manager: "Manager",
};

const ROLE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  hr_management: "default",
  manager: "secondary",
};

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "manager" as string,
  });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erreur lors du chargement des utilisateurs");
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreateDialog() {
    setEditingUser(null);
    setFormData({ email: "", full_name: "", password: "", role: "manager" });
    setDialogOpen(true);
  }

  function openEditDialog(user: Profile) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: "",
      role: user.role,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (editingUser) {
      // Update existing user profile
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          role: formData.role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingUser.id);

      if (error) {
        toast.error("Erreur lors de la mise à jour", {
          description: error.message,
        });
      } else {
        toast.success("Utilisateur mis à jour");
        setDialogOpen(false);
        loadUsers();
      }
    } else {
      // Create new user via API route
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error("Erreur lors de la création", {
          description: data.error || "Une erreur est survenue",
        });
      } else {
        toast.success("Utilisateur créé avec succès");
        setDialogOpen(false);
        loadUsers();
      }
    }
    setSaving(false);
  }

  async function handleDelete(user: Profile) {
    if (!confirm(`Supprimer l'utilisateur ${user.full_name} ?`)) return;

    const res = await fetch(`/api/users/${user.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Utilisateur supprimé");
      loadUsers();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground">
            Créez et gérez les utilisateurs et leurs rôles
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvel utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingUser
                    ? "Modifier l'utilisateur"
                    : "Créer un utilisateur"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Modifiez les informations de l'utilisateur."
                    : "Remplissez les informations pour créer un nouveau compte."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nom complet</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    required
                  />
                </div>
                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      minLength={8}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="hr_management">
                        RH / Direction
                      </SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Enregistrement..."
                    : editingUser
                      ? "Mettre à jour"
                      : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : profiles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  Aucun utilisateur
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_COLORS[user.role]}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
