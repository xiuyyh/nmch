
"use client";

import React, { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  WashingMachine, 
  Clock, 
  History, 
  AlertCircle,
  CheckCircle2,
  Brush,
  ListTodo,
  TrendingUp,
  BedDouble,
  Loader2
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { startOfDay, endOfDay, format } from "date-fns";
import { cn } from "@/lib/utils";

export default function FacilityOverviewPage() {
  const firestore = useFirestore();

  const today = useMemo(() => ({
    start: startOfDay(new Date()),
    end: endOfDay(new Date())
  }), []);

  // 1. Housekeeping Logs for Today
  const hLogsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "housekeepingLogs"),
      where("timestamp", ">=", today.start),
      where("timestamp", "<=", today.end),
      orderBy("timestamp", "desc")
    );
  }, [firestore, today]);
  const { data: hLogs, loading: hLoading } = useCollection(hLogsQuery);

  // 2. Laundry Logs for Today
  const lLogsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "laundryLogs"),
      where("timestamp", ">=", today.start),
      where("timestamp", "<=", today.end),
      orderBy("timestamp", "desc")
    );
  }, [firestore, today]);
  const { data: lLogs, loading: lLoading } = useCollection(lLogsQuery);

  // 3. Pending Requests
  const requestsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "materialRequests"),
      where("status", "==", "Pending"),
      limit(10)
    );
  }, [firestore]);
  const { data: requests, loading: rLoading } = useCollection(requestsQuery);

  // 4. Recently Checked Out Rooms (Needs Cleaning)
  const recentCheckoutQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "roomBookings"),
      where("status", "==", "checked_out"),
      where("actualCheckOutDate", ">=", today.start),
      orderBy("actualCheckOutDate", "desc"),
      limit(10)
    );
  }, [firestore, today]);
  const { data: checkouts, loading: cLoading } = useCollection(recentCheckoutQuery);

  const stats = useMemo(() => {
    const cleaned = hLogs?.reduce((sum, l) => sum + (l.roomsCleaned || 0), 0) || 0;
    const washed = lLogs?.reduce((sum, l) => sum + (l.itemsWashed || 0), 0) || 0;
    return { cleaned, washed, pending: requests?.length || 0, dirty: checkouts?.length || 0 };
  }, [hLogs, lLogs, requests, checkouts]);

  if (hLoading || lLoading || rLoading || cLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Syncing Facility Operations...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["admin", "housekeeper", "laundry"]}>
      <AppShell>
        <div className="space-y-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                Facility Overview
              </h1>
              <p className="text-muted-foreground mt-1">Combined cleaning and laundry operations status for today.</p>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 h-10 px-4 font-bold uppercase tracking-widest text-[10px]">
              {format(new Date(), "PPPP")}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Brush className="w-3 h-3 text-primary" /> Rooms Cleaned
                </span>
                <CardTitle className="text-4xl font-headline">{stats.cleaned}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Daily Productivity</p></CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <WashingMachine className="w-3 h-3 text-emerald-500" /> Items Washed
                </span>
                <CardTitle className="text-4xl font-headline">{stats.washed}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Wash Output Total</p></CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ListTodo className="w-3 h-3 text-amber-500" /> Pending Requests
                </span>
                <CardTitle className="text-4xl font-headline">{stats.pending}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Awaiting Fulfillment</p></CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-destructive">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <BedDouble className="w-3 h-3 text-destructive" /> Checked Out
                </span>
                <CardTitle className="text-4xl font-headline">{stats.dirty}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Attention Required</p></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="glass-card">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-lg uppercase flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" /> Check-Out Queue (Needs Cleaning)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {checkouts?.map(c => (
                    <div key={c.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-white uppercase text-sm">{c.apartmentName} — {c.roomNumber}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Checked out by {c.guestName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-primary uppercase block">Time</span>
                        <span className="text-xs text-white/80">{c.actualCheckOutDate?.toDate ? format(c.actualCheckOutDate.toDate(), "HH:mm") : "..."}</span>
                      </div>
                    </div>
                  ))}
                  {checkouts?.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground italic text-xs uppercase font-bold">No recently checked-out units</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-lg uppercase flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" /> Today's Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {hLogs?.slice(0, 5).map(l => (
                    <div key={l.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-primary/10 rounded-lg text-primary"><Brush className="w-4 h-4" /></div>
                         <div className="flex flex-col">
                           <span className="text-sm font-bold text-white uppercase">{l.staffName}</span>
                           <span className="text-[10px] text-muted-foreground font-bold uppercase">Cleaned {l.roomsCleaned} Rooms</span>
                         </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-bold">{format(l.timestamp.toDate(), "HH:mm")}</span>
                    </div>
                  ))}
                  {lLogs?.slice(0, 5).map(l => (
                    <div key={l.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><WashingMachine className="w-4 h-4" /></div>
                         <div className="flex flex-col">
                           <span className="text-sm font-bold text-white uppercase">{l.staffName}</span>
                           <span className="text-[10px] text-muted-foreground font-bold uppercase">Washed {l.itemsWashed} Items</span>
                         </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-bold">{format(l.timestamp.toDate(), "HH:mm")}</span>
                    </div>
                  ))}
                  {stats.cleaned === 0 && stats.washed === 0 && (
                    <div className="p-12 text-center text-muted-foreground italic text-xs uppercase font-bold">No facility records for today yet</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
