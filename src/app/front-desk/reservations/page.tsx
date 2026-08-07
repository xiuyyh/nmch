
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  Search, 
  User, 
  Phone, 
  Clock, 
  ChevronRight, 
  Trash2,
  CheckCircle2,
  Loader2,
  MoreVertical,
  LogOut,
  ArrowRight
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, orderBy, doc, deleteDoc, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { sendTelegramNotification } from "@/lib/notifications";

export default function ReservationsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const reservationsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "reservations"), where("status", "==", "upcoming"), orderBy("arrivalDate", "asc"));
  }, [firestore]);

  const { data: reservations, loading } = useCollection(reservationsQuery);

  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter(r => 
      r.guestName?.toLowerCase().includes(search.toLowerCase()) ||
      r.apartmentName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [reservations, search]);

  const handleCancel = async (id: string, guestName: string) => {
    if (!firestore) return;
    deleteDoc(doc(firestore, "reservations", id)).then(() => {
      toast({ title: "Reservation Cancelled", description: `Booking for ${guestName} removed.` });
    });
  };

  const handleCheckIn = async (reservation: any) => {
    if (!firestore || !user) return;
    setProcessingId(reservation.id);

    try {
      const staffName = user.displayName || user.email;
      
      const bookingData = {
        apartmentId: reservation.apartmentId,
        apartmentName: reservation.apartmentName,
        roomNumber: reservation.roomNumber,
        guestName: reservation.guestName,
        phoneNumber: reservation.phoneNumber || "",
        checkInDate: serverTimestamp(),
        checkOutDate: reservation.departureDate,
        checkInAmountPaid: reservation.depositPaid || 0,
        retainingAmountPaid: 0,
        totalStayCost: reservation.totalEstimatedCost || 0,
        status: "active",
        isPaid: (reservation.depositPaid || 0) >= (reservation.totalEstimatedCost || 0),
        staffName: staffName,
        lastModified: serverTimestamp()
      };

      await addDoc(collection(firestore, "roomBookings"), bookingData);
      await deleteDoc(doc(firestore, "reservations", reservation.id));

      // Telegram Notification
      const telegramMsg = `🏨 *RESERVATION CHECK-IN*\n\n*Guest:* ${reservation.guestName}\n*Converted From:* Reservation #${reservation.id.slice(-6).toUpperCase()}\n*Room:* ${reservation.apartmentName} - ${reservation.roomNumber}\n*Staff:* ${staffName}`;
      sendTelegramNotification(firestore, telegramMsg);

      toast({ title: "Check-In Complete", description: "Reservation converted to active stay." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to convert reservation." });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="space-y-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <CalendarDays className="w-8 h-8 text-primary" /> Upcoming Reservations
              </h1>
              <p className="text-muted-foreground mt-1">Manage future bookings and pending arrivals.</p>
            </div>
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search guest or room..." 
                className="pl-10 bg-white/5 border-white/10 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Card className="glass-card overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="py-20 text-center animate-pulse text-muted-foreground font-bold uppercase tracking-widest text-xs">Syncing Calendar...</div>
              ) : filteredReservations.length === 0 ? (
                <div className="py-32 text-center opacity-40 flex flex-col items-center gap-4">
                  <CalendarDays className="w-16 h-16" />
                  <p className="font-bold uppercase tracking-widest text-sm">No upcoming reservations found</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredReservations.map((res) => (
                    <div key={res.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.01] transition-colors">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                          <span className="text-[10px] font-bold uppercase leading-none">
                            {res.arrivalDate?.toDate ? format(res.arrivalDate.toDate(), "MMM") : "???"}
                          </span>
                          <span className="text-lg font-headline font-bold">
                            {res.arrivalDate?.toDate ? format(res.arrivalDate.toDate(), "dd") : "?"}
                          </span>
                        </div>
                        <div className="min-w-0 flex flex-col">
                           <span className="font-bold text-white uppercase text-base truncate">{res.guestName}</span>
                           <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                             <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" /> {res.apartmentName} — {res.roomNumber}</span>
                             <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {res.phoneNumber || "N/A"}</span>
                           </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 md:gap-8 flex-1 md:justify-end">
                        <div className="flex flex-col md:items-end">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Est. Total</span>
                          <span className="text-sm font-bold text-white">₦{res.totalEstimatedCost?.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col md:items-end">
                          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Deposit</span>
                          <span className="text-sm font-bold text-emerald-500">₦{res.depositPaid?.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 ml-auto md:ml-0">
                          <Button 
                            onClick={() => handleCheckIn(res)}
                            disabled={processingId === res.id}
                            className="bg-primary text-primary-foreground font-bold h-11 px-6 rounded-xl shadow-lg gap-2"
                          >
                            {processingId === res.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Check-In</>}
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground"><MoreVertical className="w-5 h-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-card border-white/10 w-48">
                              <DropdownMenuItem className="text-destructive font-bold gap-2" onClick={() => handleCancel(res.id, res.guestName)}>
                                <Trash2 className="w-4 h-4" /> Cancel Reservation
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
