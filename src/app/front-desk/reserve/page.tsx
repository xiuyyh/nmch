
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  BedDouble, 
  ChevronLeft, 
  Save, 
  User, 
  Phone, 
  CalendarDays, 
  Banknote,
  Info,
  AlertCircle,
  Loader2,
  Clock
} from "lucide-react";
import { useFirestore, useUser, useCollection } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, limit } from "firebase/firestore";
import { addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { sendTelegramNotification } from "@/lib/notifications";

interface SelectedRoom {
  apartmentId: string;
  apartmentName: string;
  roomNumber: string;
}

export default function ReservePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestData, setGuestData] = useState({
    name: "",
    phone: "",
    arrivalDate: new Date().toISOString().split('T')[0],
    days: 1,
    depositPaid: 0,
    estimatedTotal: 0
  });

  const selectedRooms = useMemo<SelectedRoom[]>(() => {
    try {
      const data = searchParams.get("rooms");
      if (!data) return [];
      return JSON.parse(decodeURIComponent(data));
    } catch (e) {
      return [];
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedRooms.length === 0) {
      router.replace("/front-desk/room-manager");
    }
  }, [selectedRooms, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || selectedRooms.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const staffName = user.displayName || user.email;
      const arrival = new Date(guestData.arrivalDate);
      const departure = addDays(arrival, guestData.days);

      const promises = selectedRooms.map(room => {
        const reservationData = {
          apartmentId: room.apartmentId,
          apartmentName: room.apartmentName,
          roomNumber: room.roomNumber,
          guestName: guestData.name,
          phoneNumber: guestData.phone,
          arrivalDate: arrival,
          departureDate: departure,
          depositPaid: guestData.depositPaid / selectedRooms.length,
          totalEstimatedCost: guestData.estimatedTotal / selectedRooms.length,
          status: "upcoming",
          staffName: staffName,
          createdAt: serverTimestamp()
        };
        return addDoc(collection(firestore, "reservations"), reservationData);
      });

      await Promise.all(promises);

      // Telegram Notification
      const roomsDisplay = selectedRooms.map(r => `${r.apartmentName}-${r.roomNumber}`).join(', ');
      const telegramMsg = `📅 *NEW RESERVATION*\n\n*Guest:* ${guestData.name}\n*Arrival:* ${guestData.arrivalDate}\n*Rooms:* ${roomsDisplay}\n*Deposit:* ₦${guestData.depositPaid.toLocaleString()}\n*Staff:* ${staffName}`;
      sendTelegramNotification(firestore, telegramMsg);
      
      toast({ title: "Reservation Saved", description: `Guest ${guestData.name} has been booked for ${guestData.arrivalDate}.` });
      router.push("/front-desk/reservations");
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to process reservation." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/5">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">New Reservation</h1>
              <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Future Booking Service</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <User className="text-primary w-5 h-5" /> Reservation Details
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Guest Full Name</Label>
                        <Input required className="bg-white/5 h-12" value={guestData.name} onChange={e => setGuestData({...guestData, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Phone Number</Label>
                        <Input className="bg-white/5 h-12" value={guestData.phone} onChange={e => setGuestData({...guestData, phone: e.target.value})} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Arrival Date</Label>
                        <div className="relative">
                          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="date" required className="bg-white/5 h-12 pl-10" value={guestData.arrivalDate} onChange={e => setGuestData({...guestData, arrivalDate: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Stay Duration (Days)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="number" min="1" required className="bg-white/5 h-12 pl-10" value={guestData.days} onChange={e => setGuestData({...guestData, days: Number(e.target.value)})} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Est. Total Cost (₦)</Label>
                        <Input type="number" required className="bg-white/5 h-12" value={guestData.estimatedTotal} onChange={e => setGuestData({...guestData, estimatedTotal: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-emerald-500">Deposit Received (₦)</Label>
                        <Input type="number" className="bg-white/5 border-emerald-500/20 h-12 font-bold" value={guestData.depositPaid} onChange={e => setGuestData({...guestData, depositPaid: Number(e.target.value)})} />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/[0.02] border-t border-white/5 p-6">
                    <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-primary text-primary-foreground font-bold text-lg rounded-2xl shadow-xl uppercase tracking-widest">
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save className="w-6 h-6 mr-2" /> Book Reservation</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5 p-4">
                  <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <BedDouble className="w-4 h-4" /> Target Units
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/5">
                    {selectedRooms.map((room, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white uppercase">{room.apartmentName}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Room {room.roomNumber}</span>
                        </div>
                        <Badge variant="outline" className="border-white/10 text-[8px]">Pending</Badge>
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
