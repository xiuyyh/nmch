
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

  const requestsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "materialRequests"),
      where("status", "==", "Pending"),
      limit(10)
    );
  }, [firestore]);
  const { data: requests, loading: rLoading } = useCollection(requestsQuery);

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
        <div className="flex h-[60vh] items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Syncing Facility Grid...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["admin", "housekeeper", "laundry"]}>
      <AppShell>
        <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                Facility Overview
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Daily cleaning and laundry operations status.</p>
            </div>
            <Badge variant="outline" className="bg-white/5 border-white/10 h-9 px-4 font-bold uppercase tracking-widest text-[9px] sm:text-[10px] w-full sm:w-auto text-center sm:text-left justify-center sm:justify-start">
              {format(new Date(), "PPP")}
            </Badge>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="glass-card border-l-4 border-l-primary h-28 sm:h-32 flex flex-col justify-between p-3 sm:p-4">
              <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Brush className="w-3 h-3 text-primary" /> Cleaned
              </span>
              <CardTitle className="text-2xl sm:text-4xl font-headline">{stats.cleaned}</CardTitle>
              <p className="text-[7px] sm:text-[9px] font-bold text-muted-foreground uppercase">Today</p>
            </Card>

            <Card className="glass-card border-l-4 border-l-emerald-500 h-28 sm:h-32 flex flex-col justify-between p-3 sm:p-4">
              <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <WashingMachine className="w-3 h-3 text-emerald-500" /> Washed
              </span>
              <CardTitle className="text-2xl sm:text-4xl font-headline">{stats.washed}</CardTitle>
              <p className="text-[7px] sm:text-[9px] font-bold text-muted-foreground uppercase">Items</p>
            </Card>

            <Card className="glass-card border-l-4 border-l-amber-500 h-28 sm:h-32 flex flex-col justify-between p-3 sm:p-4">
              <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <ListTodo className="w-3 h-3 text-amber-500" /> Requests
              </span>
              <CardTitle className="text-2xl sm:text-4xl font-headline">{stats.pending}</CardTitle>
              <p className="text-[7px] sm:text-[9px] font-bold text-muted-foreground uppercase">Pending</p>
            </Card>

            <Card className="glass-card border-l-4 border-l-destructive h-28 sm:h-32 flex flex-col justify-between p-3 sm:p-4">
              <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <BedDouble className="w-3 h-3 text-destructive" /> Checked Out
              </span>
              <CardTitle className="text-2xl sm:text-4xl font-headline">{stats.dirty}</CardTitle>
              <p className="text-[7px] sm:text-[9px] font-bold text-muted-foreground uppercase">Needs Service</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <Card className="glass-card overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/[0.02] p-4">
                <CardTitle className="text-base sm:text-lg uppercase flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" /> Check-Out Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {checkouts?.map(c => (
                    <div key={c.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01]">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white uppercase text-xs sm:text-sm truncate">{c.apartmentName} — {c.roomNumber}</span>
                        <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase truncate">By {c.guestName}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[8px] font-bold text-primary uppercase block">Time</span>
                        <span className="text-xs text-white/80">{c.actualCheckOutDate?.toDate ? format(c.actualCheckOutDate.toDate(), "HH:mm") : "..."}</span>
                      </div>
                    </div>
                  ))}
                  {checkouts?.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground italic text-[10px] uppercase font-bold px-4">No recent check-outs</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/[0.02] p-4">
                <CardTitle className="text-base sm:text-lg uppercase flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> Recent Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {hLogs?.slice(0, 4).map(l => (
                    <div key={l.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0"><Brush className="w-4 h-4" /></div>
                         <div className="flex flex-col min-w-0">
                           <span className="text-xs sm:text-sm font-bold text-white uppercase truncate">{l.staffName}</span>
                           <span className="text-[9px] sm:text-[10px] text-muted-foreground font-bold uppercase truncate">Cleaned {l.roomsCleaned} Units</span>
                         </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-bold shrink-0">{format(l.timestamp.toDate(), "HH:mm")}</span>
                    </div>
                  ))}
                  {lLogs?.slice(0, 4).map(l => (
                    <div key={l.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0"><WashingMachine className="w-4 h-4" /></div>
                         <div className="flex flex-col min-w-0">
                           <span className="text-xs sm:text-sm font-bold text-white uppercase truncate">{l.staffName}</span>
                           <span className="text-[9px] sm:text-[10px] text-muted-foreground font-bold uppercase truncate">Processed {l.itemsWashed} Items</span>
                         </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-bold shrink-0">{format(l.timestamp.toDate(), "HH:mm")}</span>
                    </div>
                  ))}
                  {stats.cleaned === 0 && stats.washed === 0 && (
                    <div className="py-12 text-center text-muted-foreground italic text-[10px] uppercase font-bold px-4">No records for today yet</div>
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
