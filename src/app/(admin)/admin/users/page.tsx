"use client";

import { useState } from "react";
import { Search, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { searchUsersAcrossTenants } from "../actions";
import type { UserAcrossTenants } from "@/lib/types/admin";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAcrossTenants[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (searchQuery?: string, searchPage?: number) => {
    const q = searchQuery ?? query;
    const p = searchPage ?? page;
    if (q.length < 2) return;
    setLoading(true);
    try {
      const result = await searchUsersAcrossTenants(q, p);
      setUsers(result.users);
      setTotal(result.total);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Recherche utilisateurs</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recherche cross-tenant par email ou nom
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              handleSearch(query, 1);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Email ou nom (min. 2 caracteres)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={query.length < 2 || loading}>
              Rechercher
            </Button>
          </form>

          {loading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-muted rounded" />
              ))}
            </div>
          )}

          {!loading && searched && (
            <>
              <p className="text-sm text-muted-foreground">
                {total} resultat(s) trouve(s)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Rejoint le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucun utilisateur trouve
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {user.email}
                            {user.is_platform_admin && (
                              <Shield className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{user.full_name || "-"}</TableCell>
                        <TableCell>
                          {user.tenant_name ? (
                            <Link
                              href={`/admin/tenants/${user.tenant_id}`}
                              className="text-primary hover:underline"
                            >
                              {user.tenant_name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.role ? (
                            <Badge variant="outline">{user.role}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {user.joined_at
                            ? new Date(user.joined_at).toLocaleDateString("fr-FR")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => {
                      const newPage = page - 1;
                      setPage(newPage);
                      handleSearch(query, newPage);
                    }}
                  >
                    Precedent
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => {
                      const newPage = page + 1;
                      setPage(newPage);
                      handleSearch(query, newPage);
                    }}
                  >
                    Suivant
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
