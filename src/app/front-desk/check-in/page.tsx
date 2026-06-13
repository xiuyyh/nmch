
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
  Loader2
} from "lucide-react";
import { useFirestore, useUser, useCollection } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, limit } from "firebase/firestore";
import { addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SelectedRoom {
  apartmentId: string;
  apartmentName: string;
  roomNumber: string;
}

export default function CheckInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestData, setGuestData] = useState({
    name: searchParams.get("guestName") || "",
    phone: searchParams.get("phoneNumber") || "",
    days: 1,
    amountPaid: 0,
    totalCost: 0
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

  const shiftQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "frontDeskShifts"),
      where("staffId", "==", user.uid),
      where("status", "==", "active"),
      limit(1)
    );
  }, [firestore, user]);
  const { data: shifts, loading: shiftLoading } = useCollection(shiftQuery);
  const activeShift = shifts?.[0];

  useEffect(() => {
    if (selectedRooms.length === 0) {
      router.replace("/front-desk/room-manager");
    }
  }, [selectedRooms, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !activeShift || selectedRooms.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const promises = selectedRooms.map(room => {
        const bookingData = {
          apartmentId: room.apartmentId,
          apartmentName: room.apartmentName,
          roomNumber: room.roomNumber,
          guestName: guestData.name,
          phoneNumber: guestData.phone,
          checkInDate: serverTimestamp(),
          checkOutDate: addDays(new Date(), guestData.days),
          checkInAmountPaid: guestData.amountPaid / selectedRooms.length,
          retainingAmountPaid: 0,
          totalStayCost: guestData.totalCost / selectedRooms.length,
          status: "active",
          isPaid: (guestData.amountPaid / selectedRooms.length) >= (guestData.totalCost / selectedRooms.length),
          staffName: user.displayName || user.email,
          lastModified: serverTimestamp()
        };
        return addDoc(collection(firestore, "roomBookings"), bookingData);
      });

      await Promise.all(promises);
      
      toast({ title: "Registration Complete", description: `Guest ${guestData.name} registered successfully.` });
      router.push("/front-desk/room-manager");
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to process check-in." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (shiftLoading) return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse">VERIFYING SHIFT...</div></AppShell>;

  if (!activeShift) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-6 p-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-2xl font-headline font-bold">Shift Not Active</h2>
          <Button onClick={() => router.push("/front-desk/shift")} className="w-full max-w-xs">Start Shift First</Button>
        </div>
      </AppShell>
    );
  }

  const outstanding = Math.max(0, guestData.totalCost - guestData.amountPaid);

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/5 shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-headline font-bold uppercase tracking-tight truncate">Check-In</h1>
              <p className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-widest font-bold truncate">Staff: {activeShift.staffName}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5 p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg font-headline flex items-center gap-2">
                    <User className="text-primary w-5 h-5" /> Guest Particulars
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-6 pt-6 p-4 sm:p-6">
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
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Planned Stay (Days)</Label>
                        <div className="relative">
                          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="number" min="1" required className="bg-white/5 h-12 pl-10" value={guestData.days} onChange={e => setGuestData({...guestData, days: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Cost (₦)</Label>
                        <div className="relative">
                          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="number" required className="bg-white/5 h-12 pl-10" value={guestData.totalCost} onChange={e => setGuestData({...guestData, totalCost: Number(e.target.value)})} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-primary">Initial Payment Received (₦)</Label>
                      <div className="relative">
                        <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/60" />
                        <Input type="number" className="bg-white/10 border-primary/20 h-14 text-xl font-bold pl-12" value={guestData.amountPaid} onChange={e => setGuestData({...guestData, amountPaid: Number(e.target.value)})} />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/[0.02] border-t border-white/5 p-4 sm:p-6 flex flex-col gap-4">
                    <div className="w-full flex justify-between items-end px-1">
                       <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-muted-foreground uppercase">Balance Due</span>
                         <span className={cn("text-xl sm:text-2xl font-headline font-bold", outstanding <= 0 ? "text-emerald-500" : "text-destructive")}>
                           ₦{outstanding.toLocaleString()}
                         </span>
                       </div>
                       <Badge variant="outline" className={cn("h-7 uppercase font-bold text-[8px] sm:text-[10px]", outstanding <= 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20")}>
                         {outstanding <= 0 ? "Settled" : "Unpaid"}
                       </Badge>
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-primary text-primary-foreground font-bold text-lg rounded-2xl shadow-xl uppercase tracking-widest">
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save className="w-6 h-6 mr-2" /> Complete</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5 p-4">
                  <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <BedDouble className="w-4 h-4" /> Allocated Units
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/5">
                    {selectedRooms.map((room, idx) => (
                      <div key={idx} className="p-3 sm:p-4 flex items-center justify-between hover:bg-white/[0.01]">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white uppercase">{room.apartmentName}</span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Room {room.roomNumber}</span>
                        </div>
                        <Badge variant="outline" className="border-white/10 bg-white/5 text-[8px] h-5">Selected</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-4 bg-white/[0.02] border-t border-white/5">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                      Costs and payments will be distributed evenly across these {selectedRooms.length} units for audit.
                    </p>
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
