
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileSearch, 
  Search, 
  User, 
  Clock, 
  History, 
  Package, 
  Warehouse, 
  Settings2,
  RefreshCw,
  PlusCircle,
  AlertCircle
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { formatNigeriaTime, cn } from "@/lib/utils";

export default function AdminActionsPage() {
  const firestore = useFirestore();
  const [search, setSearch] = useState("");

  const actionsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "adminActions"),
      orderBy("timestamp", "desc"),
      limit(100)
    );
  }, [firestore]);

  const { data: actions, loading } = useCollection(actionsQuery);

  const filteredActions = useMemo(() => {
    if (!actions) return [];
    return actions.filter(a => 
      a.adminName?.toLowerCase().includes(search.toLowerCase()) ||
      a.action?.toLowerCase().includes(search.toLowerCase()) ||
      a.details?.toLowerCase().includes(search.toLowerCase()) ||
      a.entity?.toLowerCase().includes(search.toLowerCase())
    );
  }, [actions, search]);

  const getActionIcon = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("CREATE")) return <PlusCircle className="w-4 h-4 text-emerald-500" />;
    if (act.includes("UPDATE")) return <RefreshCw className="w-4 h-4 text-primary" />;
    if (act.includes("DELETE")) return <AlertCircle className="w-4 h-4 text-destructive" />;
    if (act.includes("RESTOCK") || act.includes("RECEIVE")) return <Warehouse className="w-4 h-4 text-amber-500" />;
    return <Settings2 className="w-4 h-4 text-muted-foreground" />;
  };

  const getEntityBadge = (entity: string) => {
    const e = entity?.toUpperCase() || "SYSTEM";
    switch (e) {
      case "INVENTORY": return <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1"><Package className="w-3 h-3" /> BAR</Badge>;
      case "WAREHOUSE": return <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 gap-1"><Warehouse className="w-3 h-3" /> STORE</Badge>;
      case "CATEGORY": return <Badge variant="outline" className="bg-purple-500/5 text-purple-500 border-purple-500/20 gap-1">CAT</Badge>;
      case "REQUEST": return <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20 gap-1">REQ</Badge>;
      default: return <Badge variant="outline">{e}</Badge>;
    }
  };

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <AppShell>
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <FileSearch className="w-8 h-8 text-primary" /> Admin Operations Log
              </h1>
              <p className="text-muted-foreground mt-1">Audit trail of sensitive modifications made by authorized personnel.</p>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Filter by admin, action, or item..." 
              className="pl-10 bg-white/5 border-white/10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-white/5 bg-white/[0.02]">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> Timeline of Events
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-20 text-center animate-pulse text-muted-foreground uppercase font-bold text-xs tracking-widest">Accessing Archive...</div>
              ) : filteredActions.length === 0 ? (
                <div className="py-20 text-center opacity-40 italic">No actions recorded in this view.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredActions.map((log) => (
                    <div key={log.id} className="p-6 flex flex-col sm:flex-row gap-6 hover:bg-white/[0.01] transition-colors">
                      <div className="flex items-start gap-4 shrink-0 sm:w-56">
                        <div className="flex flex-col gap-2">
                           <div className="flex items-center gap-2 text-white font-bold">
                             <User className="w-4 h-4 text-primary" /> {log.adminName}
                           </div>
                           <div className="flex items-center gap-2 text-muted-foreground">
                             <Clock className="w-3.5 h-3.5" />
                             <span className="text-[10px] uppercase font-bold tracking-widest">
                               {log.timestamp?.toDate ? formatNigeriaTime(log.timestamp.toDate(), true) : "SYNCING..."}
                             </span>
                           </div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          {getActionIcon(log.action)}
                          <span className="font-bold text-white uppercase text-sm tracking-tight">{log.action}</span>
                          {getEntityBadge(log.entity)}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {log.details}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
