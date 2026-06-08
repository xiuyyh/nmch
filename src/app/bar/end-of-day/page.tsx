
"use client";

import React, { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Lock, 
  Unlock, 
  Calendar, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ArrowRight
} from "lucide-react";
import { useCollection, useDoc, useFirestore, useUser } from "@/firebase";
import { collection, query, where, doc, setDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { format, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function EndOfDayPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const todayStr = format(new Date(), "yyyy-MM-dd");
  
  // Fetch today's sales
  const salesQuery = useMemo(() => {
    if (!firestore) return null;
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    return query(
      collection(firestore, "sales"), 
      where("timestamp", ">=", start),
      where("timestamp", "<=", end)
    );
  }, [firestore]);

  const { data: sales, loading: salesLoading } = useCollection(salesQuery);

  // Fetch today's shifts
  const shiftsQuery = useMemo(() => {
    if (!firestore) return null;
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    return query(
      collection(firestore, "shifts"),
      where("startTime", ">=", start),
      where("startTime", "<=", end),
      orderBy("startTime", "asc")
    );
  }, [firestore]);

  const { data: shifts, loading: shiftsLoading } = useCollection(shiftsQuery);

  // Check if today is already closed
  const closingRef = useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, "dailyClosings", todayStr);
  }, [firestore, todayStr]);

  const { data: closingRecord, loading: closingLoading } = useDoc(closingRef);

  const stats = useMemo(() => {
    if (!sales) return { total: 0, count: 0, canceled: 0 };
    return {
      total: sales.filter(s => s.status !== "Canceled").reduce((sum, s) => sum + (s.total || 0), 0),
      count: sales.filter(s => s.status !== "Canceled").length,
      canceled: sales.filter(s => s.status === "Canceled").length
    };
  }, [sales]);

  const handleSettle = () => {
    if (!firestore || !user || !closingRef) return;

    // Check if any shifts are still active
    const activeShifts = shifts?.filter(s => s.status === "active");
    if (activeShifts && activeShifts.length > 0) {
      toast({
        variant: "destructive",
        title: "Settlement Denied",
        description: `There are still active shifts on duty. All staff must end their sessions before the day can be settled.`,
      });
      return;
    }

    const settlementData = {
      date: todayStr,
      settledAt: serverTimestamp(),
      settledBy: user.displayName || user.email,
      totalRevenue: stats.total,
      salesCount: stats.count
    };

    setDoc(closingRef, settlementData)
      .then(() => {
        toast({
          title: "Day Settled",
          description: `Successfully closed sales for ${todayStr}. Records are now permanent.`,
        });
      })
      .catch(async (error) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: closingRef.path,
          operation: "write",
          requestResourceData: settlementData
        }));
      });
  };

  if (salesLoading || closingLoading || shiftsLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="animate-pulse text-muted-foreground font-headline font-bold">Consolidating Daily Records...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Daily Settlement</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" /> {format(new Date(), "PPPP")}
            </p>
          </div>
          {closingRecord ? (
            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 px-4 py-1.5 rounded-full flex items-center gap-2 h-10">
              <CheckCircle2 className="w-4 h-4" /> Settled & Locked
            </Badge>
          ) : (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 px-4 py-1.5 rounded-full flex items-center gap-2 h-10">
              <Clock className="w-4 h-4" /> Day in Progress
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Consolidated Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline font-bold text-primary">₦{stats.total.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline font-bold">{stats.count}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline font-bold">{shifts?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
             <Card className="glass-card border-t-4 border-t-primary">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Shift Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {shifts?.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground italic font-bold uppercase tracking-widest text-[10px]">No shifts recorded today</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {shifts?.map((shift) => {
                      const shiftSales = sales?.filter(s => s.shiftId === shift.id && s.status !== "Canceled") || [];
                      const shiftRevenue = shiftSales.reduce((sum, s) => sum + (s.total || 0), 0);
                      
                      return (
                        <div key={shift.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-white">{shift.staffName}</span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60">
                              {format(shift.startTime.toDate(), "HH:mm")} - {shift.endTime ? format(shift.endTime.toDate(), "HH:mm") : "Present"}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-headline font-bold text-white">₦{shiftRevenue.toLocaleString()}</span>
                            <span className="text-[10px] uppercase font-bold text-primary/70">{shiftSales.length} Transactions</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={cn(
              "glass-card border-t-4",
              closingRecord ? "border-t-emerald-500" : "border-t-amber-500"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {closingRecord ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                  Daily Finalization Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Settlement Status</span>
                    <span className={cn("font-bold text-sm", closingRecord ? "text-emerald-500" : "text-amber-500")}>
                      {closingRecord ? "LOCKED & SECURED" : "PENDING AUDIT"}
                    </span>
                  </div>
                  {closingRecord && (
                    <>
                      <div className="flex justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Settled At</span>
                        <span className="font-bold text-sm">
                          {closingRecord.settledAt?.toDate ? format(closingRecord.settledAt.toDate(), "dd MMM | HH:mm:ss") : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Audit Personnel</span>
                        <span className="font-bold text-sm">{closingRecord.settledBy}</span>
                      </div>
                    </>
                  )}
                </div>

                {!closingRecord && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-500 uppercase tracking-widest text-[10px]">Operational Policy</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Finalizing the day will lock all sales records for {todayStr}. Once settled, staff will no longer be able to cancel transactions or open new shifts for this date. Ensure all staff have ended their sessions.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
              {!closingRecord && (
                <CardFooter>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full h-14 bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg rounded-2xl shadow-xl">
                        <Lock className="w-5 h-5 mr-2" /> Finalize Daily Settlement
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-card border-white/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will close the bar sales for today. All shift records and transactions will become permanent and immutable.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-white/5 border-white/10">Cancel Audit</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSettle} className="bg-amber-600 hover:bg-amber-700">
                          Yes, Lock Today's Sales
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              )}
            </Card>
          </div>

          <div className="space-y-6">
             <Card className="glass-card">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Today's Revenue Flow</CardTitle>
              </CardHeader>
              <CardContent className="py-6">
                <div className="space-y-6">
                  {['Cash', 'Card', 'Transfer'].map((method) => {
                    const methodSales = sales?.filter(s => s.method === method && s.status !== "Canceled") || [];
                    const methodTotal = methodSales.reduce((sum, s) => sum + (s.total || 0), 0);
                    const percentage = stats.total > 0 ? (methodTotal / stats.total) * 100 : 0;
                    
                    return (
                      <div key={method} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-bold text-white uppercase">{method}</span>
                          <span className="font-headline font-bold text-lg">₦{methodTotal.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
