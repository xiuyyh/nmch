
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
  User, 
  History,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  BedDouble,
  Banknote,
  Loader2,
  Contact
} from "lucide-react";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, limit, getDocs } from "firebase/firestore";
import { format, differenceInMinutes, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn, formatNigeriaTime } from "@/lib/utils";
import Link from "next/link";

const COOLDOWN_MINUTES = 15; 

export default function FrontDeskShiftPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);

  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userRecord } = useDoc(userRef);
  const isAdmin = userRecord?.role === 'admin';

  const allActiveShiftsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "frontDeskShifts"),
      where("status", "==", "active"),
      orderBy("startTime", "desc"),
      limit(10)
    );
  }, [firestore]);
  const { data: allActiveShifts, loading: activeLoading } = useCollection(allActiveShiftsQuery);
  
  const myActiveShift = useMemo(() => allActiveShifts?.find(s => s.staffId === user?.uid), [allActiveShifts, user]);
  const otherActiveShift = useMemo(() => allActiveShifts?.find(s => s.staffId !== user?.uid), [allActiveShifts, user]);

  const lastUserShiftQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "frontDeskShifts"),
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
    const minsSince = differenceInMinutes(new Date(), end);
    const remainingMins = COOLDOWN_MINUTES - minsSince;
    
    return {
      onCooldown: remainingMins > 0,
      remainingHours: Math.floor(Math.max(0, remainingMins) / 60),
      remainingMins: Math.max(0, remainingMins) % 60,
      endTime: end
    };
  }, [lastClosedShift, isAdmin]);

  const historyQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "frontDeskShifts"), orderBy("startTime", "desc"), limit(10));
  }, [firestore]);
  const { data: history } = useCollection(historyQuery);

  const handleStartShift = async () => {
    if (!firestore || !user || isStarting) return;
    
    if (myActiveShift) {
      window.location.reload();
      return;
    }

    if (otherActiveShift && !isAdmin) {
      toast({ variant: "destructive", title: "Counter Occupied", description: `${otherActiveShift.staffName} is currently signed in. Handover required.` });
      return;
    }

    if (cooldownStatus.onCooldown && !isAdmin) {
      toast({ variant: "destructive", title: "Personal Cooldown Active", description: `Please wait ${cooldownStatus.remainingMins}m more.` });
      return;
    }

    setIsStarting(true);

    const bookingsSnap = await getDocs(query(collection(firestore, "roomBookings"), where("status", "==", "active")));
    const occupiedCount = bookingsSnap.size;
    let totalDebt = 0;
    bookingsSnap.docs.forEach(d => {
      const data = d.data();
      const outstanding = data.totalStayCost - (data.checkInAmountPaid + (data.retainingAmountPaid || 0));
      if (outstanding > 0) totalDebt += outstanding;
    });

    const shiftData = {
      staffId: user.uid,
      staffName: user.displayName || user.email,
      startTime: serverTimestamp(),
      openingOccupiedRooms: occupiedCount,
      openingUnpaidDebt: totalDebt,
      status: "active"
    };

    addDoc(collection(firestore, "frontDeskShifts"), shiftData)
      .then(() => {
        addDoc(collection(firestore, "adminActions"), {
          adminName: user.displayName || user.email,
          adminId: user.uid,
          action: "START_FRONT_DESK_SHIFT",
          entity: "RECEPTION",
          details: `Staff ${user.displayName || user.email} started shift. Opening occupancy: ${occupiedCount} rooms.`,
          timestamp: serverTimestamp()
        }).catch(() => {});
        toast({ title: "Shift Started", description: "Handover stats recorded." });
      })
      .finally(() => setIsStarting(false));
  };

  const handleEndShift = () => {
    if (!firestore || !myActiveShift) return;
    const shiftRef = doc(firestore, "frontDeskShifts", myActiveShift.id);
    updateDoc(shiftRef, { status: "closed", endTime: serverTimestamp() }).then(() => {
      addDoc(collection(firestore, "adminActions"), {
        adminName: user?.displayName || user?.email,
        adminId: user?.uid,
        action: "END_FRONT_DESK_SHIFT",
        entity: "RECEPTION",
        details: `Staff ${user?.displayName || user?.email} ended receptionist shift.`,
        timestamp: serverTimestamp()
      }).catch(() => {});
      toast({ title: "Shift Closed", description: "Your personal 15-minute cooldown has initiated." });
    });
  };

  if (activeLoading) return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse">Syncing Shift Control...</div></AppShell>;

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-12">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">Receptionist Shift</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Multi-handover Accountability System
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {!myActiveShift ? (
                <div className="space-y-6">
                  {otherActiveShift && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Handover Pending</p>
                          <p className="text-sm font-bold text-white">{otherActiveShift.staffName} is currently signed in.</p>
                        </div>
                      </div>
                      <Badge className="bg-amber-500 text-amber-950 font-bold uppercase text-[10px]">Action Needed</Badge>
                    </div>
                  )}

                  {cooldownStatus.onCooldown && !isAdmin && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-4">
                      <AlertCircle className="w-6 h-6 text-destructive" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-destructive uppercase tracking-widest">Personal Security Lock</p>
                        <p className="text-xs text-muted-foreground">
                          To ensure accurate session data, you must wait <strong>{cooldownStatus.remainingMins}m</strong> before starting another session.
                        </p>
                      </div>
                    </div>
                  )}

                  <Card className="glass-card border-t-4 border-t-primary overflow-hidden">
                    <CardHeader className="bg-white/5 border-b border-white/5">
                      <CardTitle className="text-lg uppercase flex items-center gap-2"><Play className="w-5 h-5 text-primary" /> Start Session</CardTitle>
                    </CardHeader>
                    <CardContent className="py-12 text-center space-y-4">
                      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto"><Contact className="w-10 h-10 text-primary" /></div>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto">Starting your shift will record exactly how many rooms are occupied and any outstanding guest debts at this precise moment.</p>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        onClick={handleStartShift} 
                        disabled={isStarting || (!!otherActiveShift && !isAdmin) || (cooldownStatus.onCooldown && !isAdmin)} 
                        className="w-full h-16 bg-primary text-primary-foreground font-bold text-xl rounded-2xl shadow-xl"
                      >
                        {isStarting ? (
                          <Loader2 className="animate-spin" />
                        ) : (otherActiveShift && !isAdmin) ? (
                          "Waiting for Handover..."
                        ) : (cooldownStatus.onCooldown && !isAdmin) ? (
                          `Locked (${cooldownStatus.remainingMins}m)`
                        ) : (
                          "Verify Handover & Start"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              ) : (
                <Card className="glass-card border-l-4 border-l-emerald-500">
                  <CardHeader className="bg-white/5 border-b border-white/5">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2 text-emerald-500 font-headline"><CheckCircle2 className="w-5 h-5" /> Active Front Desk</CardTitle>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 uppercase font-bold text-[10px]">On Duty</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-8 space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Opening Occupancy</span>
                        <div className="flex items-center gap-2 text-xl font-bold"><BedDouble className="w-5 h-5 text-primary" /> {myActiveShift.openingOccupiedRooms} Rooms</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Opening Debt</span>
                        <div className="flex items-center gap-2 text-xl font-bold"><Banknote className="w-5 h-5 text-destructive" /> ₦{myActiveShift.openingUnpaidDebt.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-xs text-center text-muted-foreground uppercase font-bold tracking-widest">
                       Shift Started: {myActiveShift.startTime?.toDate ? formatNigeriaTime(myActiveShift.startTime.toDate()) : "..."}
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/[0.02]">
                    <Button variant="ghost" onClick={handleEndShift} className="w-full h-14 text-destructive font-bold uppercase tracking-widest hover:bg-destructive/10">End Session & Finalize Records</Button>
                  </CardFooter>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5 bg-white/[0.02]"><CardTitle className="text-sm font-bold uppercase flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Shift Logs</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/5">
                    {history?.map(s => (
                      <div key={s.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-bold text-white">{s.staffName}</span>
                          <Badge variant="outline" className="text-[9px] uppercase">{s.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                           <span>{s.startTime?.toDate ? formatNigeriaTime(s.startTime.toDate()) : "..."}</span>
                           <span>{s.openingOccupiedRooms} Rooms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
