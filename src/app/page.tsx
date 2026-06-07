
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
  Clock
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { startOfDay, endOfDay, format } from "date-fns";

export default function Dashboard() {
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

  // 2. Fetch Active Sessions
  const activeSessionsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "tableSessions"));
  }, [firestore]);

  const { data: activeSessions, loading: sessionsLoading } = useCollection(activeSessionsQuery);

  // 3. Fetch Inventory for Low Stock alerts
  const inventoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventory"));
  }, [firestore]);

  const { data: inventory, loading: inventoryLoading } = useCollection(inventoryQuery);

  // 4. Calculate Stats
  const stats = useMemo(() => {
    const validSales = todaySales?.filter(s => s.status !== "Canceled") || [];
    const revenue = validSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const activeCount = activeSessions?.length || 0;
    const lowStockCount = inventory?.filter(i => i.category !== 'FOOD' && i.stock <= i.min).length || 0;
    const avgSale = validSales.length > 0 ? revenue / validSales.length : 0;

    return [
      { label: "Today's Revenue", value: `₦${revenue.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
      { label: "Active Table Tabs", value: activeCount.toString(), icon: PackageCheck, color: "text-secondary" },
      { label: "Low Stock Items", value: lowStockCount.toString(), icon: AlertCircle, color: "text-destructive" },
      { label: "Avg. Sale Value", value: `₦${avgSale.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: "text-primary" },
    ];
  }, [todaySales, activeSessions, inventory]);

  // 5. Process Chart Data (Hourly buckets)
  const chartData = useMemo(() => {
    if (!todaySales) return [];
    
    const buckets: Record<string, number> = {};
    const validSales = todaySales.filter(s => s.status !== "Canceled");
    
    validSales.forEach(sale => {
      if (sale.timestamp?.toDate) {
        const hour = format(sale.timestamp.toDate(), "ha"); // e.g., "4pm"
        buckets[hour] = (buckets[hour] || 0) + (sale.total || 0);
      }
    });

    // We just return the last few active hours
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

  if (salesLoading || sessionsLoading || inventoryLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <AppShell>
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="text-3xl font-headline font-bold mb-2 uppercase tracking-tight">Management Dashboard</h1>
            <p className="text-muted-foreground">Operational intelligence and real-time sales metrics.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-headline">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart */}
            <Card className="lg:col-span-2 glass-card">
              <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> Hourly Sales Velocity
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] w-full pt-4">
                {chartData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={chartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                      <XAxis 
                        dataKey="time" 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={8}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="sales" 
                        fill="var(--color-sales)" 
                        radius={[4, 4, 0, 0]} 
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

            {/* Recent Activity */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-xl font-headline">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {todaySales?.slice(0, 7).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-white">{sale.tableNumber}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          {sale.timestamp?.toDate ? format(sale.timestamp.toDate(), "HH:mm") : "Just now"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-headline font-bold text-primary">₦{(sale.total || 0).toLocaleString()}</span>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase">{sale.method}</span>
                      </div>
                    </div>
                  ))}
                  {(!todaySales || todaySales.length === 0) && (
                    <div className="py-20 text-center flex flex-col items-center opacity-40">
                      <PackageCheck className="w-10 h-10 mb-2" />
                      <p className="italic text-xs">No transactions today</p>
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
