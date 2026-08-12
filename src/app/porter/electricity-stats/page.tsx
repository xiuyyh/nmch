
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  TrendingUp, 
  Building2, 
  ArrowUpRight, 
  PieChart as PieChartIcon,
  Loader2,
  Banknote,
  History,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Clock,
  AlertCircle
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
import { collection, query, where, limit } from "firebase/firestore";
import { format, isSameMonth, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const COLORS = ['#eab308', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'];
const LEDGER_PER_PAGE = 5;

export default function ElectricityStatsPage() {
  const firestore = useFirestore();
  const [viewDate, setViewDate] = useState(new Date());
  const [ledgerPage, setLedgerPage] = useState(1);

  // Simplified query: No orderBy to avoid Index requirement. Sorting is done on client.
  const electricityQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "expenses"),
      where("type", "==", "Electricity"),
      limit(200)
    );
  }, [firestore]);

  const { data: rawExpenses, loading, error: queryError } = useCollection(electricityQuery);

  const stats = useMemo(() => {
    if (!rawExpenses || rawExpenses.length === 0) return null;

    // Monthly Total for SELECTED Month
    const monthlyExpenses = rawExpenses.filter(e => 
      e.timestamp?.toDate && isSameMonth(e.timestamp.toDate(), viewDate)
    ).sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return timeB - timeA;
    });

    const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Lifetime Total
    const grandTotal = rawExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Apartment Distribution for SELECTED Month
    const apartmentTotals: Record<string, number> = {};
    monthlyExpenses.forEach(e => {
      const apt = e.apartmentName || "General/Other";
      apartmentTotals[apt] = (apartmentTotals[apt] || 0) + (Number(e.amount) || 0);
    });

    const apartmentData = Object.entries(apartmentTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Monthly Trend (Global)
    const monthlyTrend: Record<string, number> = {};
    const sortedExpenses = [...rawExpenses].sort((a, b) => {
      const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return tA - tB;
    });
    
    sortedExpenses.forEach(e => {
      if (e.timestamp?.toDate) {
        const monthYear = format(e.timestamp.toDate(), "MMM yy");
        monthlyTrend[monthYear] = (monthlyTrend[monthYear] || 0) + (Number(e.amount) || 0);
      }
    });

    const trendData = Object.entries(monthlyTrend)
      .map(([month, amount]) => ({ month, amount }))
      .slice(-6);

    return {
      monthlyTotal,
      grandTotal,
      apartmentData,
      trendData,
      monthlyExpenses,
      topApartment: apartmentData[0] || { name: "N/A", value: 0 }
    };
  }, [rawExpenses, viewDate]);

  useEffect(() => {
    setLedgerPage(1);
  }, [viewDate]);

  const paginatedLedger = useMemo(() => {
    if (!stats?.monthlyExpenses) return [];
    const start = (ledgerPage - 1) * LEDGER_PER_PAGE;
    return stats.monthlyExpenses.slice(start, start + LEDGER_PER_PAGE);
  }, [stats?.monthlyExpenses, ledgerPage]);

  const ledgerTotalPages = Math.max(1, Math.ceil((stats?.monthlyExpenses?.length || 0) / LEDGER_PER_PAGE));

  const nextMonth = () => setViewDate(prev => addMonths(prev, 1));
  const prevMonth = () => setViewDate(prev => subMonths(prev, 1));

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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">
                Electricity Analytics
              </h1>
              <p className="text-muted-foreground mt-1">Deeper insights into energy consumption costs across the hotel.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="h-10 w-10 text-muted-foreground hover:text-white">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col items-center px-6 min-w-[140px]">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none mb-1">Viewing Period</span>
                <span className="text-sm font-bold text-white uppercase">{format(viewDate, "MMMM yyyy")}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="h-10 w-10 text-muted-foreground hover:text-white" disabled={isSameMonth(viewDate, new Date())}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {queryError && (
            <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-2xl flex flex-col gap-4 text-destructive">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="font-bold uppercase tracking-widest">Database Connection Notice</h3>
              </div>
              <p className="text-sm leading-relaxed">
                The application encountered an error while fetching global electricity records. This is likely due to missing database indexes required for complex filtering.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-card border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Spend in {format(viewDate, "MMM")}</span>
                <CardTitle className="text-3xl font-headline text-white">₦{stats?.monthlyTotal.toLocaleString() || 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase">
                  <ArrowUpRight className="w-3 h-3" /> Monthly Flow
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Top Unit ({format(viewDate, "MMM")})</span>
                <CardTitle className="text-2xl font-headline text-white truncate">{stats?.topApartment?.name || "N/A"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[10px] font-bold text-amber-500 uppercase">
                  Impact: ₦{stats?.topApartment?.value.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-l-4 border-l-white/10">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lifetime Energy Spend</span>
                <CardTitle className="text-3xl font-headline text-white">₦{stats?.grandTotal.toLocaleString() || 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">
                  Total Ledger Records
                </div>
              </CardContent>
            </Card>
          </div>

          {!stats || stats.trendData.length === 0 ? (
            <div className="py-32 text-center glass-card rounded-3xl border-dashed border-white/10 flex flex-col items-center gap-4 opacity-40">
              <History className="w-16 h-16" />
              <p className="font-headline font-bold uppercase tracking-widest">No energy records found in ledger</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="glass-card">
                  <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-base uppercase flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Spend Trend (History)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[350px] pt-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.trendData}>
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
                        <Bar dataKey="amount" fill="#eab308" radius={[6, 6, 0, 0]} barSize={40}>
                           {stats.trendData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.month === format(viewDate, "MMM yy") ? "#eab308" : "rgba(234, 179, 8, 0.2)"} 
                              />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-base uppercase flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-primary" /> Distribution ({format(viewDate, "MMMM")})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[350px] flex items-center justify-center pt-6">
                    {stats.apartmentData.length === 0 ? (
                      <div className="text-center text-muted-foreground italic text-xs uppercase font-bold opacity-30">No data for this month</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={stats.apartmentData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {stats.apartmentData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            formatter={(val: number) => `₦${val.toLocaleString()}`}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="glass-card overflow-hidden">
                  <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-base uppercase flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" /> Apartment Ranking ({format(viewDate, "MMM")})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                      {stats.apartmentData.length === 0 ? (
                        <div className="p-20 text-center text-muted-foreground italic text-xs uppercase font-bold opacity-30">No usage recorded</div>
                      ) : stats.apartmentData.map((apt, idx) => (
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
                                  style={{ width: `${(apt.value / (stats.monthlyTotal || 1)) * 100}%` }} 
                                />
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-headline font-bold text-white">₦{apt.value.toLocaleString()}</span>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                              {((apt.value / (stats.monthlyTotal || 1)) * 100).toFixed(1)}% of month
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card overflow-hidden flex flex-col">
                  <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-base uppercase flex items-center gap-2">
                      <History className="w-4 h-4 text-primary" /> Detailed Transaction Ledger
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1">
                    <div className="divide-y divide-white/5">
                      {paginatedLedger.length === 0 ? (
                        <div className="p-20 text-center text-muted-foreground italic text-xs uppercase font-bold opacity-30">No transactions this month</div>
                      ) : paginatedLedger.map((expense) => (
                        <div key={expense.id} className="p-4 hover:bg-white/[0.01] transition-all">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-2">
                                 <span className="font-bold text-white text-sm uppercase">{expense.apartmentName}</span>
                                 <Badge variant="outline" className="text-[7px] uppercase h-4 bg-primary/10 text-primary border-primary/20">LIGHT BILL</Badge>
                               </div>
                               <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground/60 uppercase">
                                 <Clock className="w-3 h-3" /> {expense.timestamp?.toDate ? format(expense.timestamp.toDate(), "dd MMM | HH:mm") : "..."}
                               </div>
                             </div>
                             <span className="text-lg font-headline font-bold text-white">₦{expense.amount?.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/80 uppercase">
                              <User className="w-3 h-3" /> Handled by: {expense.staffName}
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground/40">#{expense.id.slice(-6).toUpperCase()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  {ledgerTotalPages > 1 && (
                    <CardFooter className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Page {ledgerPage} of {ledgerTotalPages}</span>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg border-white/10" 
                          onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                          disabled={ledgerPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg border-white/10" 
                          onClick={() => setLedgerPage(p => Math.min(ledgerTotalPages, p + 1))}
                          disabled={ledgerPage === ledgerTotalPages}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardFooter>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </AppShell>
    </RoleGuard>
  );
}
