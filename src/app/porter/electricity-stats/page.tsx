"use client";

import React, { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  TrendingUp, 
  Building2, 
  CalendarDays, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Loader2,
  Banknote
} from "lucide-react";
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Pie,
  PieChart as RechartsPieChart
} from "recharts";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";

const COLORS = ['#eab308', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'];

export default function ElectricityStatsPage() {
  const firestore = useFirestore();

  const electricityQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "expenses"),
      where("type", "==", "Electricity"),
      orderBy("timestamp", "desc")
    );
  }, [firestore]);

  const { data: expenses, loading } = useCollection(electricityQuery);

  const stats = useMemo(() => {
    if (!expenses) return null;

    const currentMonth = new Date();
    const monthlyTotal = expenses
      .filter(e => e.timestamp?.toDate && isSameMonth(e.timestamp.toDate(), currentMonth))
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const apartmentTotals: Record<string, number> = {};
    expenses.forEach(e => {
      const apt = e.apartmentName || "General/Other";
      apartmentTotals[apt] = (apartmentTotals[apt] || 0) + (e.amount || 0);
    });

    const apartmentData = Object.entries(apartmentTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Monthly Trend Data
    const monthlyTrend: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.timestamp?.toDate) {
        const monthYear = format(e.timestamp.toDate(), "MMM yy");
        monthlyTrend[monthYear] = (monthlyTrend[monthYear] || 0) + (e.amount || 0);
      }
    });

    const trendData = Object.entries(monthlyTrend)
      .map(([month, amount]) => ({ month, amount }))
      .reverse()
      .slice(-6);

    return {
      monthlyTotal,
      grandTotal: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
      apartmentData,
      trendData,
      topApartment: apartmentData[0]
    };
  }, [expenses]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Aggregating Energy Data...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["admin", "porter"]}>
      <AppShell>
        <div className="space-y-10 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Zap className="w-8 h-8 text-primary" /> Electricity Analytics
              </h1>
              <p className="text-muted-foreground mt-1">Deeper insights into energy consumption costs across the hotel.</p>
            </div>
            <Badge variant="outline" className="bg-white/5 border-white/10 h-10 px-6 font-bold uppercase tracking-widest text-[10px]">
              Global Ledger Audit
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-card border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Spend This Month</span>
                <CardTitle className="text-3xl font-headline text-white">₦{stats?.monthlyTotal.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase">
                  <ArrowUpRight className="w-3 h-3" /> Live Tracking
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Highest Consumption Unit</span>
                <CardTitle className="text-2xl font-headline text-white truncate">{stats?.topApartment?.name || "N/A"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[10px] font-bold text-amber-500 uppercase">
                  Total: ₦{stats?.topApartment?.value.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-white/10">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lifetime Spend</span>
                <CardTitle className="text-3xl font-headline text-white">₦{stats?.grandTotal.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">
                  Total Recorded Outflow
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="glass-card">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-base uppercase flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Spend Trend (Last 6 Months)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px] pt-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.trendData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#888', fontSize: 10, fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#888', fontSize: 10 }} 
                      tickFormatter={(val) => `₦${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#eab308' }}
                      formatter={(val: number) => [`₦${val.toLocaleString()}`, 'Spend']}
                    />
                    <Bar dataKey="amount" fill="#eab308" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-base uppercase flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-primary" /> Distribution by Apartment
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px] flex items-center justify-center pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={stats?.apartmentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats?.apartmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      formatter={(val: number) => `₦${val.toLocaleString()}`}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-white/5 bg-white/[0.02]">
              <CardTitle className="text-base uppercase flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Apartment Ranking Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {stats?.apartmentData.map((apt, idx) => (
                  <div key={apt.name} className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        #{idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white uppercase text-sm group-hover:text-primary transition-colors">{apt.name}</span>
                        <div className="w-32 h-1 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-1000" 
                            style={{ width: `${(apt.value / (stats.grandTotal || 1)) * 100}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-headline font-bold text-white">₦{apt.value.toLocaleString()}</span>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                        {((apt.value / (stats.grandTotal || 1)) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                ))}
                {stats?.apartmentData.length === 0 && (
                  <div className="py-20 text-center opacity-40 italic text-sm uppercase font-bold tracking-widest">
                    No electricity data found in ledger.
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
