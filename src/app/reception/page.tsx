
"use client";

import React, { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  BedDouble, 
  Users, 
  Banknote, 
  Calendar,
  Clock,
  UserCheck,
  TrendingUp,
  Loader2
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ReceptionOverviewPage() {
  const firestore = useFirestore();

  // 1. Fetch All Active Bookings
  const bookingsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "roomBookings"), where("status", "==", "active"));
  }, [firestore]);
  const { data: bookings, loading: bookingsLoading } = useCollection(bookingsQuery);

  // 2. Fetch Active Receptionist Shift
  const shiftQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "frontDeskShifts"),
      where("status", "==", "active"),
      limit(1)
    );
  }, [firestore]);
  const { data: activeShifts, loading: shiftLoading } = useCollection(shiftQuery);
  const activeShift = activeShifts?.[0];

  const stats = useMemo(() => {
    if (!bookings) return { occupied: 0, unpaid: 0, guestCount: 0 };
    let unpaid = 0;
    bookings.forEach(b => {
      const debt = b.totalStayCost - (b.checkInAmountPaid + (b.retainingAmountPaid || 0));
      if (debt > 0) unpaid += debt;
    });
    return {
      occupied: bookings.length,
      unpaid,
      guestCount: bookings.length // Assuming 1 main guest per room record
    };
  }, [bookings]);

  if (bookingsLoading || shiftLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <LayoutDashboard className="w-8 h-8 text-primary" /> Reception Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Live status of guest rooms and financial balances.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <BedDouble className="w-3 h-3 text-primary" /> Occupancy
                </span>
                <CardTitle className="text-3xl font-headline">{stats.occupied} Rooms</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-emerald-500 uppercase">{40 - stats.occupied} Available</p></CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Banknote className="w-3 h-3 text-destructive" /> Outstanding Debt
                </span>
                <CardTitle className="text-3xl font-headline text-destructive">₦{stats.unpaid.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Unsettled Guest Accounts</p></CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <UserCheck className="w-3 h-3 text-secondary" /> Active Guests
                </span>
                <CardTitle className="text-3xl font-headline">{stats.guestCount}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-muted-foreground uppercase">Verified Registrations</p></CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-3 h-3 text-primary" /> Staff on Duty
                </span>
                <CardTitle className="text-xl font-headline truncate">{activeShift?.staffName || "None"}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-[10px] font-bold text-primary uppercase">{activeShift ? 'Session Live' : 'Closed'}</p></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 glass-card">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-lg uppercase flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Recently Checked In</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {bookings?.slice(0, 5).map(b => (
                    <div key={b.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-white uppercase text-sm">{b.guestName}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Room {b.roomNumber}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Checkout</span>
                        <span className="text-xs font-bold text-white">{format(b.checkOutDate.toDate(), "dd MMM, yyyy")}</span>
                      </div>
                    </div>
                  ))}
                  {bookings?.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground italic text-xs uppercase font-bold">No active registrations</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-lg uppercase flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Shift Status</CardTitle>
              </CardHeader>
              <CardContent className="py-8 space-y-6">
                {!activeShift ? (
                  <div className="flex flex-col items-center justify-center text-center opacity-40 py-10">
                    <Clock className="w-12 h-12 mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">No active session</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Started At</span>
                      <span className="text-sm font-bold">{format(activeShift.startTime.toDate(), "HH:mm")}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Rooms on Handover</span>
                      <span className="text-sm font-bold">{activeShift.openingOccupiedRooms}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Starting Debt</span>
                      <span className="text-sm font-bold text-destructive">₦{activeShift.openingUnpaidDebt.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}

function LayoutDashboard(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}
