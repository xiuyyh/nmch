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
  Clock
} from "lucide-react";
import { useCollection, useDoc, useFirestore, useUser } from "@/firebase";
import { collection, query, where, doc, setDoc, serverTimestamp } from "firebase/firestore";
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
    // Note: This query might require an index on Firestore.
    return query(
      collection(firestore, "sales"), 
      where("timestamp", ">=", start),
      where("timestamp", "<=", end)
    );
  }, [firestore]);

  const { data: sales, loading: salesLoading } = useCollection(salesQuery);

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

  const handleSettle = async () => {
    if (!firestore || !user || !closingRef) return;

    try {
      await setDoc(closingRef, {
        date: todayStr,
        settledAt: serverTimestamp(),
        settledBy: user.displayName || user.email,
        totalRevenue: stats.total,
        salesCount: stats.count
      });

      toast({
        title: "Day Settled",
        description: `Successfully closed sales for ${todayStr}. Records are now permanent.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Settlement Failed",
        description: "Could not settle sales. Please try again.",
      });
    }
  };

  if (salesLoading || closingLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="animate-pulse text-muted-foreground font-headline font-bold">Checking Daily Status...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8">
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
              <Clock className="w-4 h-4" /> Shift in Progress
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline font-bold">₦{stats.total.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline font-bold">{stats.count}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cancellations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline font-bold text-destructive">{stats.canceled}</div>
            </CardContent>
          </Card>
        </div>

        <Card className={cn(
          "glass-card border-t-4",
          closingRecord ? "border-t-emerald-500" : "border-t-amber-500"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {closingRecord ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              Shift Settlement Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                <span className="text-muted-foreground">Settlement Status</span>
                <span className={cn("font-bold", closingRecord ? "text-emerald-500" : "text-amber-500")}>
                  {closingRecord ? "CLOSED" : "OPEN"}
                </span>
              </div>
              {closingRecord && (
                <>
                  <div className="flex justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-muted-foreground">Settled At</span>
                    <span className="font-bold">
                      {closingRecord.settledAt?.toDate ? format(closingRecord.settledAt.toDate(), "HH:mm:ss") : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-muted-foreground">Authorizing Staff</span>
                    <span className="font-bold">{closingRecord.settledBy}</span>
                  </div>
                </>
              )}
            </div>

            {!closingRecord && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-500">Important Note</p>
                  <p className="text-sm text-muted-foreground">
                    Performing End of Sales will lock all transactions for {todayStr}. Once settled, staff will no longer be able to cancel or modify today's sales records.
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
                    <Lock className="w-5 h-5 mr-2" /> Finalize Settlement
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will close the sales for today. All records will become permanent and stock cancellations will be disabled.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSettle} className="bg-amber-600 hover:bg-amber-700">
                      Yes, Settle Day
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
