
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertCircle,
  FileCheck,
  ChevronDown,
  RotateCcw,
  Eye
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { formatNigeriaTime, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function AdminActionsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

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

  const handleRestoreShift = (actionId: string, detailsStr: string) => {
    if (!firestore || !user) return;
    setRestoringId(actionId);

    try {
      const details = JSON.parse(detailsStr);
      const shiftId = details.shiftId;
      
      if (!shiftId) throw new Error("No shift ID found in log");

      const shiftRef = doc(firestore, "shifts", shiftId);
      updateDoc(shiftRef, { hidden: false })
        .then(() => {
          addDoc(collection(firestore, "adminActions"), {
            adminName: user.displayName || user.email,
            adminId: user.uid,
            action: "UNHIDE_SHIFT",
            entity: "AUDIT",
            details: `Restored visibility for shift #${shiftId.slice(-8).toUpperCase()} (Staff: ${details.staffName})`,
            timestamp: serverTimestamp()
          }).catch(() => {});
          
          toast({ title: "Shift Restored", description: "The work session is now visible in Global Audit." });
        })
        .catch(() => {
          toast({ variant: "destructive", title: "Restoration Failed", description: "The source shift record may no longer exist." });
        })
        .finally(() => setRestoringId(null));

    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not parse shift metadata from log." });
      setRestoringId(null);
    }
  };

  const getActionIcon = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("CREATE")) return <PlusCircle className="w-4 h-4 text-emerald-500" />;
    if (act.includes("UPDATE")) return <RefreshCw className="w-4 h-4 text-primary" />;
    if (act.includes("DELETE") || act.includes("HIDE")) return <AlertCircle className="w-4 h-4 text-destructive" />;
    if (act.includes("RECONCILE")) return <FileCheck className="w-4 h-4 text-amber-500" />;
    if (act.includes("UNHIDE") || act.includes("RESTORE")) return <Eye className="w-4 h-4 text-emerald-500" />;
    return <Settings2 className="w-4 h-4 text-muted-foreground" />;
  };

  const getEntityBadge = (entity: string) => {
    const e = entity?.toUpperCase() || "SYSTEM";
    switch (e) {
      case "INVENTORY": return <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1"><Package className="w-3 h-3" /> BAR</Badge>;
      case "WAREHOUSE": return <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 gap-1"><Warehouse className="w-3 h-3" /> STORE</Badge>;
      case "AUDIT": return <Badge variant="outline" className="bg-purple-500/5 text-purple-500 border-purple-500/20 gap-1">AUDIT</Badge>;
      case "REQUEST": return <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20 gap-1">REQ</Badge>;
      default: return <Badge variant="outline">{e}</Badge>;
    }
  };

  const renderDetails = (log: any) => {
    const { details, action, id } = log;
    
    if (action === "RECONCILE_INVENTORY") {
      try {
        const audit = JSON.parse(details);
        return (
          <Collapsible className="mt-4 border border-white/10 rounded-xl overflow-hidden bg-black/20">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-12 px-4 hover:bg-white/5 group">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-xs uppercase tracking-widest">{audit.title || "Audit Report"}</span>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-[10px] text-muted-foreground uppercase font-bold">{audit.summary}</span>
                   <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 border-t border-white/5 space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Item Deduction Audit</h4>
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[9px] h-8 font-bold uppercase">Item</TableHead>
                      <TableHead className="text-[9px] h-8 font-bold uppercase text-right">Start Stock</TableHead>
                      <TableHead className="text-[9px] h-8 font-bold uppercase text-right">Deducted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.itemsProcessed?.map((item: any, idx: number) => (
                      <TableRow key={idx} className="border-white/5 hover:bg-white/5">
                        <TableCell className="py-2 text-xs font-bold text-white">{item.name}</TableCell>
                        <TableCell className="py-2 text-xs text-right text-muted-foreground">{item.startingStock}</TableCell>
                        <TableCell className="py-2 text-xs text-right text-destructive font-bold">-{item.deducted}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Processed Sale Receipts</h4>
                <div className="flex flex-wrap gap-1.5">
                  {audit.allSaleIds?.map((id: string) => (
                    <Badge key={id} variant="outline" className="font-mono text-[9px] border-white/10 bg-white/[0.02]">
                      #{id.slice(-8).toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      } catch (e) {
        return <p className="text-sm text-muted-foreground leading-relaxed italic">{details}</p>;
      }
    }

    if (action === "HIDE_SHIFT") {
      try {
        const meta = JSON.parse(details);
        return (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-destructive/5 border border-destructive/10 rounded-xl mt-2">
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Duplicate Shift Hidden: {meta.staffName}</p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">
                Start Time: {meta.startTime} | ID: #{meta.shiftId.slice(-8).toUpperCase()}
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={() => handleRestoreShift(id, details)}
              disabled={restoringId === id}
              className="bg-emerald-600 hover:bg-emerald-700 h-9 px-4 font-bold text-xs uppercase tracking-widest gap-2 shadow-lg"
            >
              {restoringId === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Restore Visibility
            </Button>
          </div>
        );
      } catch (e) {
        return <p className="text-sm text-muted-foreground italic">{details}</p>;
      }
    }

    return <p className="text-sm text-muted-foreground leading-relaxed">{details}</p>;
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
                        <div className="max-w-3xl">
                          {renderDetails(log)}
                        </div>
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

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
