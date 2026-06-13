
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
  Backpack,
  Loader2
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, limit } from "firebase/firestore";
import { format, differenceInHours, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn, formatNigeriaTime } from "@/lib/utils";

const COOLDOWN_HOURS = 8;

export default function PorterShiftPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);

  // 1. Fetch All Active Porter Shifts
  const allActiveShiftsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "porterShifts"),
      where("status", "==", "active"),
      limit(5)
    );
  }, [firestore]);
  const { data: allActiveShifts, loading: activeLoading } = useCollection(allActiveShiftsQuery);
  
  const myActiveShift = useMemo(() => allActiveShifts?.find(s => s.staffId === user?.uid), [allActiveShifts, user]);
  const otherActiveShift = useMemo(() => allActiveShifts?.find(s => s.staffId !== user?.uid), [allActiveShifts, user]);

  // 2. Fetch Last Closed Shift for Cooldown
  const lastUserShiftQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "porterShifts"),
      where("staffId", "==", user.uid),
      where("status", "==", "closed"),
      orderBy("endTime", "desc"),
      limit(1)
    );
  }, [firestore, user]);
  const { data: lastUserShifts } = useCollection(lastUserShiftQuery);
  const lastClosedShift = lastUserShifts?.[0];

  const cooldownStatus = useMemo(() => {
    if (!lastClosedShift?.endTime) return { onCooldown: false };
    const end = lastClosedShift.endTime.toDate();
    const hoursSince = differenceInHours(new Date(), end);
    return {
      onCooldown: hoursSince < COOLDOWN_HOURS,
      remaining: COOLDOWN_HOURS - hoursSince,
      endTime: end
    };
  }, [lastClosedShift]);

  // 3. Fetch Global Shift History
  const historyQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "porterShifts"), orderBy("startTime", "desc"), limit(10));
  }, [firestore]);
  const { data: history } = useCollection(historyQuery);

  const handleStartShift = async () => {
    if (!firestore || !user) return;
    
    if (otherActiveShift) {
      toast({ variant: "destructive", title: "Counter Occupied", description: `${otherActiveShift.staffName} is currently on duty.` });
      return;
    }

    if (cooldownStatus.onCooldown) {
      toast({ variant: "destructive", title: "Cooldown Active", description: `Please wait ${cooldownStatus.remaining}h.` });
      return;
    }

    setIsStarting(true);

    const shiftData = {
      staffId: user.uid,
      staffName: user.displayName || user.email,
      startTime: serverTimestamp(),
      status: "active"
    };

    addDoc(collection(firestore, "porterShifts"), shiftData)
      .then(() => toast({ title: "Shift Started", description: "Porter session initialized." }))
      .finally(() => setIsStarting(false));
  };

  const handleEndShift = () => {
    if (!firestore || !myActiveShift) return;
    const shiftRef = doc(firestore, "porterShifts", myActiveShift.id);
    updateDoc(shiftRef, { status: "closed", endTime: serverTimestamp() }).then(() => {
      toast({ title: "Shift Closed", description: "8-hour cooldown initiated." });
    });
  };

  if (activeLoading) return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse">Syncing Porter Shift Control...</div></AppShell>;

  return (
    <RoleGuard allowedRoles={["porter", "admin"]}>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-12">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">Porter Shift</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Verified Duty Logging System
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
                    </div>
                  )}

                  {cooldownStatus.onCooldown && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-4">
                      <AlertCircle className="w-6 h-6 text-destructive" />
                      <p className="text-xs text-muted-foreground">
                        Cooldown active for another <strong>{cooldownStatus.remaining} hours</strong>. (Last session ended {formatDistanceToNow(cooldownStatus.endTime)} ago).
                      </p>
                    </div>
                  )}

                  <Card className="glass-card border-t-4 border-t-primary overflow-hidden">
                    <CardHeader className="bg-white/5 border-b border-white/5">
                      <CardTitle className="text-lg uppercase flex items-center gap-2"><Play className="w-5 h-5 text-primary" /> Start Duty</CardTitle>
                    </CardHeader>
                    <CardContent className="py-12 text-center space-y-4">
                      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto"><Backpack className="w-10 h-10 text-primary" /></div>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto">Starting your shift allows you to log guest checks, meal services, and room deliveries.</p>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        onClick={handleStartShift} 
                        disabled={isStarting || !!otherActiveShift || cooldownStatus.onCooldown} 
                        className="w-full h-16 bg-primary text-primary-foreground font-bold text-xl rounded-2xl shadow-xl"
                      >
                        {isStarting ? <Loader2 className="animate-spin" /> : "Sign In to Porter Hub"}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              ) : (
                <Card className="glass-card border-l-4 border-l-emerald-500">
                  <CardHeader className="bg-white/5 border-b border-white/5">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2 text-emerald-500 font-headline"><CheckCircle2 className="w-5 h-5" /> Active Duty</CardTitle>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 uppercase font-bold text-[10px]">On Duty</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-8 space-y-8">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-2">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duty Personnel</span>
                       <span className="text-2xl font-headline font-bold text-white">{myActiveShift.staffName}</span>
                       <div className="flex items-center gap-2 text-xs text-primary font-bold">
                         <Clock className="w-3.5 h-3.5" /> Started at {format(myActiveShift.startTime.toDate(), "HH:mm, dd MMM")}
                       </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/[0.02]">
                    <Button variant="ghost" onClick={handleEndShift} className="w-full h-14 text-destructive font-bold uppercase tracking-widest hover:bg-destructive/10">End Duty & Log Out</Button>
                  </CardFooter>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5 bg-white/[0.02]"><CardTitle className="text-sm font-bold uppercase flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Activity Log</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/5">
                    {history?.map(s => (
                      <div key={s.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-bold text-white">{s.staffName}</span>
                          <Badge variant="outline" className="text-[9px] uppercase">{s.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                           <span>{s.startTime?.toDate ? format(s.startTime.toDate(), "dd MMM, HH:mm") : "..."}</span>
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
