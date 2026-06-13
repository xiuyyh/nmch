"use client";

import React, { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  AlertCircle, 
  PackageCheck, 
  Banknote,
  Loader2,
  Clock,
  User,
  ChefHat,
  Utensils,
  ShieldCheck
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function BarOverviewDashboard() {
  const firestore = useFirestore();

  // 1. Fetch the globally active shift (who is currently on duty)
  const activeShiftQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "shifts"),
      where("status", "==", "active"),
      limit(1)
    );
  }, [firestore]);

  const { data: activeShifts, loading: shiftLoading } = useCollection(activeShiftQuery);
  const activeShift = activeShifts?.[0];

  // 2. Fetch Sales for the ACTIVE SHIFT only
  const shiftSalesQuery = useMemo(() => {
    if (!firestore || !activeShift) return null;
    return query(
      collection(firestore, "sales"),
      where("shiftId", "==", activeShift.id),
      orderBy("timestamp", "desc")
    );
  }, [firestore, activeShift]);

  const { data: shiftSales, loading: salesLoading } = useCollection(shiftSalesQuery);

  // 3. Fetch Kitchen Orders since the shift started
  const shiftFoodOrdersQuery = useMemo(() => {
    if (!firestore || !activeShift?.startTime) return null;
    return query(
      collection(firestore, "kitchenOrders"),
      where("timestamp", ">=", activeShift.startTime),
      orderBy("timestamp", "desc")
    );
  }, [firestore, activeShift]);

  const { data: foodOrders, loading: foodLoading } = useCollection(shiftFoodOrdersQuery);

  // 4. Fetch Active Table Tabs (regardless of shift, as tables persist handovers)
  const activeSessionsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "tableSessions"));
  }, [firestore]);

  const { data: activeSessions, loading: sessionsLoading } = useCollection(activeSessionsQuery);

  // 5. Calculate Stats
  const stats = useMemo(() => {
    const validSales = shiftSales?.filter(s => s.status !== "Canceled") || [];
    const revenue = validSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const activeCount = activeSessions?.length || 0;
    const foodCount = foodOrders?.length || 0;

    return [
      { 
        label: "Active Shift Revenue", 
        value: `₦${revenue.toLocaleString()}`, 
        icon: Banknote, 
        color: "text-primary",
        sub: `${validSales.length} Transactions`
      },
      { 
        label: "Staff on Duty", 
        value: activeShift?.staffName || "None", 
        icon: User, 
        color: "text-secondary",
        sub: activeShift ? "Session Active" : "Handover Required"
      },
      { 
        label: "Shift Food Orders", 
        value: foodCount.toString(), 
        icon: ChefHat, 
        color: "text-emerald-500",
        sub: "Kitchen Queue"
      },
      { 
        label: "Open Table Tabs", 
        value: activeCount.toString(), 
        icon: PackageCheck, 
        color: "text-amber-500",
        sub: "Pending Checkout"
      },
    ];
  }, [shiftSales, activeSessions, foodOrders, activeShift]);

  // 6. Process Chart Data (Hourly buckets for the current shift)
  const chartData = useMemo(() => {
    if (!shiftSales) return [];
    
    const buckets: Record<string, number> = {};
    const validSales = shiftSales.filter(s => s.status !== "Canceled");
    
    validSales.forEach(sale => {
      if (sale.timestamp?.toDate) {
        const hour = format(sale.timestamp.toDate(), "ha"); 
        buckets[hour] = (buckets[hour] || 0) + (sale.total || 0);
      }
    });

    // Sort buckets by hour to ensure chronological order in the shift
    return Object.entries(buckets).map(([time, sales]) => ({
      time,
      sales
    })).reverse();
  }, [shiftSales]);

  const chartConfig = {
    sales: {
      label: "Sales (₦)",
      color: "hsl(var(--primary))",
    },
  };

  if (shiftLoading || salesLoading || sessionsLoading || foodLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Syncing Shift Dashboard...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["admin", "bar"]}>
      <AppShell>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold mb-2 uppercase tracking-tight text-white flex items-center gap-3">
                <Utensils className="w-8 h-8 text-primary" /> Bar Overview
              </h1>
              <p className="text-muted-foreground">Session-based performance tracking (WAT). Focus on the active worker's throughput.</p>
            </div>
            {!activeShift && (
              <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl flex items-center gap-3 animate-pulse">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">No Active Shift - Data Reset to Zero</span>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="glass-card overflow-hidden transition-all hover:border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</CardTitle>
                  <div className={cn("p-2 rounded-lg bg-white/5", stat.color)}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-headline truncate">{stat.value}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Main Chart */}
            <Card className="lg:col-span-2 glass-card">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> Shift Sales Velocity
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px] w-full pt-8">
                {chartData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={chartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                      <XAxis 
                        dataKey="time" 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={8}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 'bold' }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="sales" 
                        fill="var(--color-sales)" 
                        radius={[6, 6, 0, 0]} 
                        barSize={40}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 gap-4">
                    <TrendingUp className="w-12 h-12" />
                    <p className="italic text-sm font-bold uppercase tracking-widest">Waiting for first sale of this shift...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Food Activity */}
            <Card className="glass-card">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-primary" /> Shift Kitchen Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {foodOrders?.slice(0, 8).map((order) => (
                    <div key={order.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-white">{order.tableNumber}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border",
                            order.status === 'Delivered' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          )}>
                            {order.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">
                            {order.items?.length || 0} items
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">
                          {order.timestamp?.toDate ? format(order.timestamp.toDate(), "HH:mm") : "..."}
                        </span>
                      </div>
                    </div>
                  ))}
                  {foodOrders?.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center opacity-40 gap-4">
                      <ChefHat className="w-12 h-12" />
                      <p className="italic text-[10px] font-bold uppercase tracking-[0.2em]">No food orders recorded this shift</p>
                    </div>
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
