"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollText, AlertTriangle, Eye, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminActivityLogs } from "../actions";
import type { PlatformAdminLog } from "@/lib/types/admin";

const actionLabels: Record<string, string> = {
  suspend_tenant: "Suspension tenant",
  reactivate_tenant: "Reactivation tenant",
  delete_tenant: "Suppression tenant",
  delete_survey: "Suppression sondage",
  delete_organization: "Suppression organisation",
  view_tenant: "Consultation tenant",
};

const actionIcons: Record<string, typeof Clock> = {
  suspend_tenant: AlertTriangle,
  delete_tenant: AlertTriangle,
  delete_survey: AlertTriangle,
  delete_organization: AlertTriangle,
  view_tenant: Eye,
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<PlatformAdminLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminActivityLogs(page);
      setLogs(result.logs);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Logs d&apos;audit</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            {total} entree(s) au total
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucun log
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const Icon = actionIcons[log.action] || Clock;
                    const isDestructive = log.action.includes("delete") || log.action.includes("suspend");
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon
                              className={`h-3 w-3 ${
                                isDestructive ? "text-red-500" : "text-muted-foreground"
                              }`}
                            />
                            <span>{actionLabels[log.action] || log.action}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.target_type}</Badge>
                          {log.target_id && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {log.target_id.slice(0, 8)}...
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.metadata && Object.keys(log.metadata).length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {Object.entries(log.metadata)
                                .filter(([, v]) => v != null)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ")}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(log.created_at).toLocaleString("fr-FR")}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
