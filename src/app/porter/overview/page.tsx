
"use client";

import React, { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Backpack, 
  Coffee, 
  DoorOpen, 
  Package, 
  Clock, 
  User, 
  TrendingUp,
  Loader2,
  CalendarDays
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { startOfDay, endOfDay, format } from "date-fns";
import { cn } from "@/lib/utils";

export default function PorterOverviewPage() {
  const firestore = useFirestore();

  // 1. Fetch Today's Porter Activity
  const todayQuery = useMemo(() => {
    if (!firestore) return null;
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    return query(
      collection(firestore, "porterActions"),
      where("timestamp", ">=", start),
      where("timestamp", "<=", end),
      orderBy("timestamp", "desc")
    );
  }, [firestore]);

  const { data: actions, loading } = useCollection(todayQuery);

  // 2. Calculate Stats
  const stats = useMemo(() => {
    if (!actions) return { breakfast: 0, checks: 0, deliveries: 0 };
    
    let breakfastTotal = 0;
    let checksCount = 0;
    let deliveryCount = 0;

    actions.forEach(action => {
      if (action.type === "complimentary_meal") {
        const match = action.details.match(/\d+/);
        if (match) breakfastTotal += parseInt(match[0]);
      } else if (action.type === "guest_check") {
        checksCount++;
      } else if (action.type === "room_delivery") {
        deliveryCount++;
      }
    });

    return { breakfast: breakfastTotal, checks: checksCount, deliveries: deliveryCount };
  }, [actions]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["admin", "porter"]}>
      <AppShell>
        <div className="space-y-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Backpack className="w-8 h-8 text-primary" /> Porter Overview
              </h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary/60" /> Daily Duty Performance Summary
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-card border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Coffee className="w-3 h-3 text-emerald-500" /> Breakfasts Served
                </span>
                <CardTitle className="text-4xl font-headline">{stats.breakfast}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Total Meals Today</p></CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <DoorOpen className="w-3 h-3 text-blue-500" /> Guest Checks
                </span>
                <CardTitle className="text-4xl font-headline">{stats.checks}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Verifications Performed</p></CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Package className="w-3 h-3 text-amber-500" /> Deliveries
                </span>
                <CardTitle className="text-4xl font-headline">{stats.deliveries}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Items Delivered to Rooms</p></CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="border-b border-white/5 bg-white/[0.02]">
              <CardTitle className="text-lg uppercase flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Recent Duty Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {actions?.slice(0, 10).map((action) => (
                  <div key={action.id} className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        action.type === 'guest_check' ? "bg-blue-500/10 text-blue-500" :
                        action.type === 'complimentary_meal' ? "bg-emerald-500/10 text-emerald-500" :
                        "bg-amber-500/10 text-amber-500"
                      )}>
                        {action.type === 'guest_check' ? <DoorOpen className="w-5 h-5" /> :
                         action.type === 'complimentary_meal' ? <Coffee className="w-5 h-5" /> :
                         <Package className="w-5 h-5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">
                          {action.apartmentName === 'Hotel Wide' ? 'Global Service' : action.apartmentName}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{action.details}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-white">{action.staffName}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {format(action.timestamp.toDate(), "HH:mm")}
                      </span>
                    </div>
                  </div>
                ))}
                {actions?.length === 0 && (
                  <div className="p-20 text-center flex flex-col items-center gap-4 opacity-40">
                    <Backpack className="w-12 h-12" />
                    <p className="font-bold uppercase tracking-widest text-sm">No activity recorded for today yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
