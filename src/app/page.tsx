"use client";

import React, { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  AlertCircle, 
  PackageCheck, 
  DollarSign,
  Loader2,
  Clock,
  User,
  ChefHat,
  Utensils
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { startOfDay, endOfDay, format } from "date-fns";
import { cn } from "@/lib/utils";

export default function BarOverviewDashboard() {
  const firestore = useFirestore();

  // 1. Fetch Today's Sales
  const todaySalesQuery = useMemo(() => {
    if (!firestore) return null;
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    return query(
      collection(firestore, "sales"),
      where("timestamp", ">=", start),
      where("timestamp", "<=", end),
      orderBy("timestamp", "desc")
    );
  }, [firestore]);

  const { data: todaySales, loading: salesLoading } = useCollection(todaySalesQuery);

  // 2. Fetch Active Session (Worker on Duty)
  const activeShiftQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "shifts"),
      where("status", "==", "active"),
      limit(1)
    );
  }, [firestore]);

  const { data: activeShifts, loading: shiftLoading } = useCollection(activeShiftQuery);
  const workerOnDuty = activeShifts?.[0]?.staffName || "No active shift";

  // 3. Fetch Today's Food Orders
  const foodOrdersQuery = useMemo(() => {
    if (!firestore) return null;
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    return query(
      collection(firestore, "kitchenOrders"),
      where("timestamp", ">=", start),
      where("timestamp", "<=", end)
    );
  }, [firestore]);

  const { data: foodOrders, loading: foodLoading } = useCollection(foodOrdersQuery);

  // 4. Fetch Active Table Tabs
  const activeSessionsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "tableSessions"));
  }, [firestore]);

  const { data: activeSessions, loading: sessionsLoading } = useCollection(activeSessionsQuery);

  // 5. Calculate Stats
  const stats = useMemo(() => {
    const validSales = todaySales?.filter(s => s.status !== "Canceled") || [];
    const revenue = validSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const activeCount = activeSessions?.length || 0;
    const foodCount = foodOrders?.length || 0;

    return [
      { 
        label: "Today's Bar Revenue", 
        value: `₦${revenue.toLocaleString()}`, 
        icon: DollarSign, 
        color: "text-primary",
        sub: `${validSales.length} Transactions`
      },
      { 
        label: "Worker on Duty", 
        value: workerOnDuty, 
        icon: User, 
        color: "text-secondary",
        sub: activeShifts?.[0] ? "Currently Active" : "Handover Required"
      },
      { 
        label: "Total Food Orders", 
        value: foodCount.toString(), 
        icon: ChefHat, 
        color: "text-emerald-500",
        sub: "From Kitchen Queue"
      },
      { 
        label: "Open Table Tabs", 
        value: activeCount.toString(), 
        icon: PackageCheck, 
        color: "text-amber-500",
        sub: "Pending Checkout"
      },
    ];
  }, [todaySales, activeSessions, foodOrders, workerOnDuty, activeShifts]);

  // 6. Process Chart Data (Hourly buckets)
  const chartData = useMemo(() => {
    if (!todaySales) return [];
    
    const buckets: Record<string, number> = {};
    const validSales = todaySales.filter(s => s.status !== "Canceled");
    
    validSales.forEach(sale => {
      if (sale.timestamp?.toDate) {
        const hour = format(sale.timestamp.toDate(), "ha"); 
        buckets[hour] = (buckets[hour] || 0) + (sale.total || 0);
      }
    });

    return Object.entries(buckets).map(([time, sales]) => ({
      time,
      sales
    })).reverse().slice(-7);
  }, [todaySales]);

  const chartConfig = {
    sales: {
      label: "Sales (₦)",
      color: "hsl(var(--primary))",
    },
  };

  if (salesLoading || sessionsLoading || shiftLoading || foodLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
              <p className="text-muted-foreground">Daily operations summary and real-time performance tracking.</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="glass-card overflow-hidden">
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
                  <Clock className="w-5 h-5 text-primary" /> Sales Velocity (Hourly)
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
                  <div className="h-full flex items-center justify-center text-muted-foreground italic">
                    No sales recorded yet today.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Food Activity */}
            <Card className="glass-card">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-primary" /> Latest Kitchen Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {foodOrders?.slice(0, 8).map((order) => (
                    <div key={order.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-white">{order.tableNumber}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">
                          {order.items?.length || 0} items • {order.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">
                          {order.timestamp?.toDate ? format(order.timestamp.toDate(), "HH:mm") : "Just now"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {foodOrders?.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center opacity-40">
                      <ChefHat className="w-10 h-10 mb-2" />
                      <p className="italic text-xs">No food orders processed today</p>
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
