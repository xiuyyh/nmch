"use client";

import React, { useMemo, useState, useEffect } from "react";
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
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, limit } from "firebase/firestore";
import { startOfDay, endOfDay, differenceInHours, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn, formatNigeriaTime } from "@/lib/utils";
import Link from "next/link";

const HISTORY_PER_PAGE = 5;
const COOLDOWN_HOURS = 8;

export default function ShiftManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userRecord } = useDoc(userRef);
  const isAdmin = userRecord?.role === 'admin';

  const inventoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventory"), orderBy("name"));
  }, [firestore]);
  const { data: inventory, loading: inventoryLoading } = useCollection(inventoryQuery);

  // 1. Fetch ALL Active Shifts (to check for conflicts)
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

  // 2. Fetch Last Closed Shift for THIS user (to enforce 8-hour cooldown)
  const lastUserShiftQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "shifts"),
      where("staffId", "==", user.uid),
      where("status", "==", "closed"),
      orderBy("endTime", "desc"),
      limit(1)
    );
  }, [firestore, user]);
  const { data: lastUserShifts } = useCollection(lastUserShiftQuery);
  const lastClosedShift = lastUserShifts?.[0];

  const cooldownStatus = useMemo(() => {
    if (!lastClosedShift?.endTime || isAdmin) return { onCooldown: false };
    const end = lastClosedShift.endTime.toDate ? lastClosedShift.endTime.toDate() : new Date();
    const hoursSince = differenceInHours(new Date(), end);
    return {
      onCooldown: hoursSince < COOLDOWN_HOURS,
      remaining: COOLDOWN_HOURS - hoursSince,
      endTime: end
    };
  }, [lastClosedShift, isAdmin]);

  // 3. Fetch Global Shift History (with decent limit for client pagination)
  const historyQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "shifts"),
      orderBy("startTime", "desc"),
      limit(50)
    );
  }, [firestore]);
  const { data: shiftHistory, loading: historyLoading } = useCollection(historyQuery);

  const paginatedHistory = useMemo(() => {
    if (!shiftHistory) return [];
    const start = (currentPage - 1) * HISTORY_PER_PAGE;
    return shiftHistory.slice(start, start + HISTORY_PER_PAGE);
  }, [shiftHistory, currentPage]);

  const totalPages = Math.max(1, Math.ceil((shiftHistory?.length || 0) / HISTORY_PER_PAGE));

  const handleStartShift = () => {
    if (!firestore || !user || !inventory) return;
    
    if (otherActiveShift && !isAdmin) {
      toast({
        variant: "destructive",
        title: "Session Conflict",
        description: `${otherActiveShift.staffName} is currently signed into a shift.`
      });
      return;
    }

    if (cooldownStatus.onCooldown && !isAdmin) {
      toast({
        variant: "destructive",
        title: "Cooldown Active",
        description: `You must wait ${cooldownStatus.remaining} more hours before starting another shift.`
      });
      return;
    }

    setIsStarting(true);

    const openingStock = inventory
      .filter(item => item.category !== "FOOD")
      .map(item => ({
        itemId: item.id,
        name: item.name,
        category: item.category,
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
        toast({ title: "Shift Started", description: "Opening stock recorded via verified timestamp." });
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

  const handleEndShift = () => {
    if (!firestore || !myActiveShift) return;
    
    const shiftRef = doc(firestore, "shifts", myActiveShift.id);
    updateDoc(shiftRef, {
      status: "closed",
      endTime: serverTimestamp()
    }).then(() => {
      toast({ title: "Shift Ended", description: "Session closed successfully. 8-hour cooldown initiated." });
    }).catch(error => {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not finalize shift status." });
    });
  };

  if (activeLoading || inventoryLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center animate-pulse text-muted-foreground font-headline font-bold uppercase tracking-widest">
          Synchronizing Shift Data...
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["bar"]}>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Shift Control</h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Verified Audit Trail System (WAT)
              </p>
            </div>
            {isAdmin && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Admin Override Active</Badge>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {!myActiveShift ? (
                <div className="space-y-6">
                  {otherActiveShift && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Point Occupied</p>
                          <p className="text-sm font-bold text-white">{otherActiveShift.staffName} is currently on duty.</p>
                        </div>
                      </div>
                      <Badge className="bg-amber-500 text-amber-950 font-bold">BUSY</Badge>
                    </div>
                  )}

                  {cooldownStatus.onCooldown && !isAdmin && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-4">
                      <AlertCircle className="w-6 h-6 text-destructive shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-destructive uppercase tracking-widest">Shift Lock Active</p>
                        <p className="text-xs text-muted-foreground">
                          To avoid duplicate records, you cannot start a new shift for another <strong>{cooldownStatus.remaining} hours</strong>. 
                          (Last ended: {formatDistanceToNow(cooldownStatus.endTime)} ago).
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <Card className="glass-card border-t-4 border-t-primary overflow-hidden">
                    <CardHeader className="bg-white/5 border-b border-white/5">
                      <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-tight">
                        <Play className="w-5 h-5 text-primary" /> Initialize New Session
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-12 text-center space-y-6">
                      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-primary/5">
                        <Package className="w-10 h-10 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-headline font-bold">Record Opening Stock</h3>
                        <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                          Starting your shift will take an immutable snapshot of all bar inventory. Ensure all physical stock matches before proceeding.
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="pb-8">
                      <Button 
                        onClick={handleStartShift} 
                        disabled={isStarting || (!!otherActiveShift && !isAdmin) || (cooldownStatus.onCooldown && !isAdmin)} 
                        className="w-full h-16 bg-primary text-primary-foreground font-bold text-xl rounded-2xl shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isStarting ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (otherActiveShift && !isAdmin) ? (
                          "Waiting for Handover..."
                        ) : (cooldownStatus.onCooldown && !isAdmin) ? (
                          `Shift Locked (${cooldownStatus.remaining}h)`
                        ) : (
                          <><Play className="w-6 h-6 mr-2" /> Start Shift & Log Stock</>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              ) : (
                <Card className="glass-card border-l-4 border-l-emerald-500">
                  <CardHeader className="bg-white/5 border-b border-white/5">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2 text-emerald-500 font-headline">
                        <CheckCircle2 className="w-5 h-5" /> Active Session
                      </CardTitle>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase tracking-widest font-bold text-[10px]">
                        Live Feed
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Staff Member</span>
                        <div className="flex items-center gap-2 font-bold text-xl">
                          <User className="w-5 h-5 text-primary" /> {myActiveShift.staffName}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Session Start (WAT)</span>
                        <div className="font-headline font-bold text-xl">
                          {myActiveShift.startTime?.toDate ? (
                            formatNigeriaTime(myActiveShift.startTime.toDate())
                          ) : (
                            <span className="text-primary/50 flex items-center gap-2 animate-pulse">
                              <Loader2 className="w-4 h-4 animate-spin" /> SYNCING...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Opening Stock Snapshot</span>
                        <Button asChild variant="outline" className="h-8 text-[10px] uppercase font-bold text-primary gap-2 rounded-xl border-primary/20 hover:bg-primary/10">
                          <Link href={`/bar/shift/${myActiveShift.id}`}>
                            View Full Snapshot <ExternalLink className="w-3 h-3" />
                          </Link>
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {myActiveShift.openingStock?.slice(0, 6).map((item: any, idx: number) => (
                          <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-primary/30 transition-colors">
                            <span className="text-[10px] text-muted-foreground block truncate mb-1">{item.name}</span>
                            <span className="font-headline font-bold text-lg text-primary">{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 pb-8 border-t border-white/5 bg-white/[0.01]">
                    <Button variant="ghost" onClick={handleEndShift} className="text-destructive hover:bg-destructive/10 w-full font-bold h-14 rounded-2xl text-lg uppercase tracking-tight">
                      Close Session & Perform Handover
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="glass-card flex flex-col h-full">
                <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.02]">
                  <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Shift History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-[400px]">
                  {historyLoading ? (
                    <div className="py-20 text-center animate-pulse text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">Scanning Logs...</div>
                  ) : paginatedHistory.length === 0 ? (
                    <div className="py-20 text-center text-xs text-muted-foreground italic px-6">No shift records found in history.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {paginatedHistory.map(shift => (
                        <div key={shift.id} className="p-5 space-y-3 hover:bg-white/[0.01] transition-all group">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <span className={cn(
                                "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                                shift.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-white/5 text-muted-foreground border-white/10"
                              )}>
                                {shift.status === 'active' ? '● Live' : 'Archived'}
                              </span>
                              <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">{shift.staffName}</div>
                            </div>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                              <Link href={`/bar/shift/${shift.id}`} title="View Report"><ExternalLink className="w-4 h-4" /></Link>
                            </Button>
                          </div>
                          <div className="flex flex-col gap-1 text-[10px] uppercase font-bold text-muted-foreground/60">
                            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {shift.startTime?.toDate ? formatNigeriaTime(shift.startTime.toDate()) : "SYNCING..."}</span>
                            {shift.endTime && <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Closed {formatNigeriaTime(shift.endTime.toDate())}</span>}
                          </div>
                          <div className="pt-2">
                             <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Items at start: {shift.openingStock?.length || 0}</div>
                             <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-primary/40 rounded-full" style={{ width: '40%' }} />
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="p-4 border-t border-white/5 bg-black/20">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Page {currentPage} / {totalPages}</span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg border-white/10" 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg border-white/10" 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
