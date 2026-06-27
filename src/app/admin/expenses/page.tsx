
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Banknote, 
  Search, 
  Calendar as CalendarIcon, 
  ArrowDownCircle, 
  TrendingDown, 
  Clock, 
  User, 
  Zap, 
  Settings2,
  Filter,
  Loader2,
  FileText,
  Home
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, limit, where } from "firebase/firestore";
import { formatNigeriaTime, cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, format } from "date-fns";

export default function AdminExpenseTrackerPage() {
  const firestore = useFirestore();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("All");

  const expensesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "expenses"),
      orderBy("timestamp", "desc"),
      limit(200)
    );
  }, [firestore]);

  const { data: expenses, loading } = useCollection(expensesQuery);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(e => {
      const matchSearch = e.staffName?.toLowerCase().includes(search.toLowerCase()) || 
                          e.details?.toLowerCase().includes(search.toLowerCase()) ||
                          e.apartmentName?.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "All" || e.type === filterType;
      return matchSearch && matchType;
    });
  }, [expenses, search, filterType]);

  const stats = useMemo(() => {
    if (!filteredExpenses) return { total: 0, light: 0, maintenance: 0 };
    const total = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const light = filteredExpenses.filter(e => e.type === "Electricity").reduce((sum, e) => sum + (e.amount || 0), 0);
    return { total, light };
  }, [filteredExpenses]);

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <AppShell>
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Banknote className="w-8 h-8 text-primary" /> Expense Tracker
              </h1>
              <p className="text-muted-foreground mt-1">Global audit of all business expenditures and departmental recharges.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-card border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Period Outflow</span>
                <CardTitle className="text-3xl font-headline text-white">₦{stats.total.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="glass-card border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Zap className="w-3 h-3" /> Electricity Total</span>
                <CardTitle className="text-3xl font-headline text-amber-500">₦{stats.light.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="glass-card border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Entries Logged</span>
                <CardTitle className="text-3xl font-headline text-emerald-500">{filteredExpenses.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl">
             <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
               <Input 
                placeholder="Search staff, apartment, or details..." 
                className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
               />
             </div>
             <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                   {["All", "Electricity", "Maintenance", "Supplies"].map(type => (
                     <Button 
                      key={type} 
                      size="sm" 
                      variant={filterType === type ? "default" : "ghost"}
                      onClick={() => setFilterType(type)}
                      className="h-9 text-[10px] font-bold uppercase tracking-widest rounded-lg"
                     >
                       {type}
                     </Button>
                   ))}
                </div>
             </div>
          </div>

          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2 uppercase tracking-tight">
                <FileText className="w-5 h-5 text-primary" /> Expenditure Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-20 text-center animate-pulse text-muted-foreground uppercase font-bold text-xs tracking-widest">Scanning Ledger...</div>
              ) : filteredExpenses.length === 0 ? (
                <div className="py-20 text-center opacity-40 italic">No expenses recorded matching criteria.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white/[0.02]">
                      <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest">Timestamp</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest">Category</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest">Unit/Target</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest">Details</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest">Staff</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-right">Amount (₦)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((e) => (
                        <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {e.timestamp?.toDate ? format(e.timestamp.toDate(), "dd MMM, HH:mm") : "..."}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-[8px] uppercase px-1.5 h-5 border-none",
                              e.type === 'Electricity' ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary"
                            )}>
                              {e.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium">
                              <Home className="w-3 h-3 text-primary/60" />
                              {e.apartmentName || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-white max-w-[200px] truncate">
                            {e.details}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium text-white/80">{e.staffName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-headline font-bold text-lg text-white">
                            {e.amount?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
