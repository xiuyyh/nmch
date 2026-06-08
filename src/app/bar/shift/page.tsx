
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Clock, 
  Package, 
  User, 
  History,
  CheckCircle2,
  ChevronDown,
  ArrowRight
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, limit } from "firebase/firestore";
import { format, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";

export default function ShiftManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);

  // Fetch Inventory for snapshot
  const inventoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventory"), orderBy("name"));
  }, [firestore]);
  const { data: inventory, loading: inventoryLoading } = useCollection(inventoryQuery);

  // Check for ANY active shift (to see if someone else is logged in)
  const allActiveShiftsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "shifts"),
      where("status", "==", "active"),
      limit(5)
    );
  }, [firestore]);
  const { data: allActiveShifts, loading: activeLoading } = useCollection(allActiveShiftsQuery);
  
  const myActiveShift = useMemo(() => {
    return allActiveShifts?.find(s => s.staffId === user?.uid);
  }, [allActiveShifts, user]);

  const otherActiveShift = useMemo(() => {
    return allActiveShifts?.find(s => s.staffId !== user?.uid);
  }, [allActiveShifts, user]);

  // Fetch today's shift history for this staff
  const historyQuery = useMemo(() => {
    if (!firestore || !user) return null;
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    return query(
      collection(firestore, "shifts"),
      where("startTime", ">=", start),
      where("startTime", "<=", end),
      orderBy("startTime", "desc")
    );
  }, [firestore, user]);
  const { data: shiftHistory, loading: historyLoading } = useCollection(historyQuery);

  const handleStartShift = async () => {
    if (!firestore || !user || !inventory) return;
    
    if (otherActiveShift) {
      toast({
        variant: "destructive",
        title: "Session Conflict",
        description: `${otherActiveShift.staffName} is currently signed into a shift. They must end their session before you can take over.`
      });
      return;
    }

    setIsStarting(true);

    // Snapshot all bar inventory except FOOD
    const openingStock = inventory
      .filter(item => item.category !== "FOOD")
      .map(item => ({
        itemId: item.id,
        name: item.name,
        quantity: item.stock
      }));

    const shiftData = {
      staffId: user.uid,
      staffName: user.displayName || user.email,
      startTime: serverTimestamp(),
      openingStock,
      status: "active"
    };

    addDoc(collection(firestore, "shifts"), shiftData)
      .then(() => {
        toast({ title: "Shift Started", description: "Opening stock recorded. You are now the active staff on duty." });
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "shifts",
          operation: "create",
          requestResourceData: shiftData
        }));
      })
      .finally(() => setIsStarting(false));
  };

  const handleEndShift = async () => {
    if (!firestore || !myActiveShift) return;
    
    const shiftRef = doc(firestore, "shifts", myActiveShift.id);
    updateDoc(shiftRef, {
      status: "closed",
      endTime: serverTimestamp()
    }).then(() => {
      toast({ title: "Shift Ended", description: "Your session has been closed. Please handover to the next staff." });
    });
  };

  if (activeLoading || inventoryLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center animate-pulse text-muted-foreground font-headline font-bold">Initializing Shift Control...</div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["bar"]}>
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Shift Management</h1>
            <p className="text-muted-foreground mt-1">Record opening stock and manage your active session for accurate handover.</p>
          </div>

          {!myActiveShift ? (
            <div className="space-y-6">
              {otherActiveShift && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-sm font-bold text-amber-500 uppercase tracking-widest">Handover Pending</p>
                      <p className="text-xs text-muted-foreground">{otherActiveShift.staffName} is currently on duty.</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-500 text-amber-950 font-bold">ACTIVE</Badge>
                </div>
              )}
              
              <Card className="glass-card border-t-4 border-t-amber-500 overflow-hidden">
                <CardHeader className="bg-white/5 border-b border-white/5">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" /> Start New Session
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-10 text-center space-y-6">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Package className="w-8 h-8 text-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-headline font-bold">Ready to take over?</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                      Starting your shift will take a snapshot of the current bar inventory as your **Opening Stock**. This ensures accurate sales tracking during your duty.
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleStartShift} 
                    disabled={isStarting || !!otherActiveShift} 
                    className="w-full h-14 bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg rounded-2xl shadow-xl transition-all"
                  >
                    {isStarting ? "Processing..." : otherActiveShift ? "Wait for Handover" : <><Play className="w-5 h-5 mr-2" /> Start Shift & Record Stock</>}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="glass-card md:col-span-2 border-l-4 border-l-emerald-500">
                <CardHeader className="bg-white/5 border-b border-white/5">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="w-5 h-5" /> Active Session
                    </CardTitle>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      In Progress
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-6 space-y-6">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Shift Started</span>
                      <span className="font-headline font-bold text-lg">
                        {myActiveShift.startTime?.toDate ? format(myActiveShift.startTime.toDate(), "PPP HH:mm") : "Just now"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duty Personnel</span>
                      <div className="flex items-center gap-2 font-bold text-lg">
                        <User className="w-4 h-4 text-primary" /> {myActiveShift.staffName}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Opening Stock Snapshot</span>
                      <span className="text-[10px] text-muted-foreground italic">Recorded at start of shift</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {myActiveShift.openingStock?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="font-headline font-bold text-primary">{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 pb-6">
                  <Button variant="ghost" onClick={handleEndShift} className="text-destructive hover:bg-destructive/10 w-full font-bold h-12 rounded-xl">
                    End Session & Perform Handover
                  </Button>
                </CardFooter>
              </Card>

              <div className="space-y-6">
                <Card className="glass-card">
                  <CardHeader className="pb-2 border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <History className="w-4 h-4" /> Today's Shifts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                    {historyLoading ? (
                      <div className="p-10 text-center animate-pulse text-xs text-muted-foreground uppercase font-bold tracking-widest">Loading...</div>
                    ) : shiftHistory?.length === 0 ? (
                      <div className="p-10 text-center text-xs text-muted-foreground italic">No shifts recorded today.</div>
                    ) : (
                      shiftHistory?.map(shift => (
                        <Collapsible key={shift.id} className="group border-b border-white/5 last:border-0">
                          <CollapsibleTrigger asChild>
                            <div className="p-4 space-y-2 hover:bg-white/5 cursor-pointer transition-colors">
                              <div className="flex justify-between items-center">
                                <span className={cn(
                                  "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                                  shift.status === 'active' ? "bg-emerald-500/20 text-emerald-500" : "bg-white/10 text-muted-foreground"
                                )}>
                                  {shift.status === 'active' ? 'Current' : 'Closed'}
                                </span>
                                <ChevronDown className="w-3 h-3 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-white">{shift.staffName}</span>
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/60">
                                  {shift.startTime?.toDate ? format(shift.startTime.toDate(), "HH:mm") : "-"} 
                                  {shift.endTime ? ` to ${format(shift.endTime.toDate(), "HH:mm")}` : " - Active"}
                                </span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="p-4 bg-white/5 space-y-3">
                            <div className="flex justify-between text-[10px] font-bold text-primary uppercase tracking-widest border-b border-primary/20 pb-1">
                              <span>Opening Item</span>
                              <span>Qty</span>
                            </div>
                            {shift.openingStock?.slice(0, 8).map((item: any, i: number) => (
                              <div key={i} className="flex justify-between text-[10px] border-b border-white/5 pb-1">
                                <span className="text-muted-foreground">{item.name}</span>
                                <span className="font-bold text-white">{item.quantity}</span>
                              </div>
                            ))}
                            {shift.openingStock?.length > 8 && <span className="text-[8px] text-muted-foreground italic">+{shift.openingStock.length - 8} more items recorded...</span>}
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RoleGuard>
  );
}
