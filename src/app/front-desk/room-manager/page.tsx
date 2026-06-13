
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  BedDouble, 
  Plus, 
  Calendar, 
  User, 
  Phone, 
  CheckCircle2, 
  XCircle,
  Clock,
  Banknote,
  ArrowRight,
  LogOut,
  History,
  MoreVertical,
  ShieldAlert,
  Loader2,
  CalendarPlus
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, orderBy, limit } from "firebase/firestore";
import { format, addDays, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn, formatNigeriaTime } from "@/lib/utils";

const TOTAL_ROOMS = 40;
const ROOMS = Array.from({ length: TOTAL_ROOMS }, (_, i) => (i + 1).toString().padStart(2, '0'));

export default function RoomManagerPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<any>(null);

  // 1. Check for Active Front Desk Shift
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

  // 2. Fetch All Active Bookings
  const bookingsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "roomBookings"), where("status", "==", "active"));
  }, [firestore]);
  const { data: activeBookings, loading: bookingsLoading } = useCollection(bookingsQuery);

  const occupiedRoomsMap = useMemo(() => {
    if (!activeBookings) return {};
    const map: Record<string, any> = {};
    activeBookings.forEach(b => { map[b.roomNumber] = b; });
    return map;
  }, [activeBookings]);

  const handleCheckIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !selectedRoom || !user || !activeShift) return;

    const formData = new FormData(e.currentTarget);
    const guestName = formData.get("guestName") as string;
    const phone = formData.get("phone") as string;
    const days = Number(formData.get("days"));
    const amountPaid = Number(formData.get("amountPaid"));
    const totalCost = Number(formData.get("totalCost"));

    const bookingData = {
      roomNumber: selectedRoom,
      guestName,
      phoneNumber: phone,
      checkInDate: serverTimestamp(),
      checkOutDate: addDays(new Date(), days),
      checkInAmountPaid: amountPaid,
      retainingAmountPaid: 0,
      totalStayCost: totalCost,
      status: "active",
      isPaid: amountPaid >= totalCost,
      staffName: user.displayName || user.email,
      lastModified: serverTimestamp()
    };

    addDoc(collection(firestore, "roomBookings"), bookingData)
      .then(() => {
        toast({ title: "Guest Checked In", description: `Room ${selectedRoom} is now occupied.` });
        setIsCheckInOpen(false);
        setSelectedRoom(null);
      });
  };

  const handleExtendStay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !activeBooking || !user) return;

    const formData = new FormData(e.currentTarget);
    const extraDays = Number(formData.get("extraDays"));
    const retainingPaid = Number(formData.get("retainingPaid"));
    const extraCost = Number(formData.get("extraCost"));

    const newCheckOut = addDays(activeBooking.checkOutDate.toDate(), extraDays);
    const totalNewCost = activeBooking.totalStayCost + extraCost;
    const totalPaid = activeBooking.checkInAmountPaid + activeBooking.retainingAmountPaid + retainingPaid;

    const bookingRef = doc(firestore, "roomBookings", activeBooking.id);
    updateDoc(bookingRef, {
      checkOutDate: newCheckOut,
      totalStayCost: totalNewCost,
      retainingAmountPaid: activeBooking.retainingAmountPaid + retainingPaid,
      isPaid: totalPaid >= totalNewCost,
      lastModified: serverTimestamp()
    }).then(() => {
      toast({ title: "Stay Extended", description: `Guest in Room ${activeBooking.roomNumber} extended by ${extraDays} days.` });
      setIsExtendOpen(false);
      setActiveBooking(null);
    });
  };

  const handleCheckout = (booking: any) => {
    if (!firestore) return;
    const bookingRef = doc(firestore, "roomBookings", booking.id);
    updateDoc(bookingRef, { 
      status: "checked_out", 
      actualCheckOutDate: serverTimestamp(),
      lastModified: serverTimestamp() 
    }).then(() => {
      toast({ title: "Guest Checked Out", description: `Room ${booking.roomNumber} is now vacant.` });
    });
  };

  if (shiftLoading) return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse">Syncing Front Desk...</div></AppShell>;

  if (!activeShift) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-headline font-bold">Front Desk Closed</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Please start your receptionist shift to access the Room Manager.</p>
          </div>
          <Button asChild className="h-14 px-8 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl">
            <a href="/front-desk/shift">Open Shift Management</a>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="space-y-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <BedDouble className="w-8 h-8 text-primary" /> Room Manager
              </h1>
              <p className="text-muted-foreground mt-1">Live grid of hospitality units. Green is vacant, Amber is occupied.</p>
            </div>
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-2.5 rounded-2xl">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Occupancy</span>
                <span className="text-xl font-headline font-bold text-primary">
                  {Object.keys(occupiedRoomsMap).length} / {TOTAL_ROOMS}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-4">
            {ROOMS.map(num => {
              const booking = occupiedRoomsMap[num];
              const isOccupied = !!booking;
              const hasDebt = isOccupied && !booking.isPaid;

              return (
                <div key={num} className="relative group">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={cn(
                        "w-full h-32 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-2 shadow-lg",
                        isOccupied 
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-500 hover:bg-amber-500/20" 
                          : "bg-emerald-500/5 border-emerald-500/10 text-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                      )}>
                        <BedDouble className={cn("w-7 h-7", isOccupied ? "opacity-100" : "opacity-20")} />
                        <span className="text-lg font-headline font-bold">Room {num}</span>
                        {isOccupied && (
                          <div className="absolute top-2 right-2">
                             {hasDebt ? (
                               <Badge className="bg-destructive text-white border-none p-1"><Banknote className="w-3 h-3" /></Badge>
                             ) : (
                               <Badge className="bg-emerald-500 text-white border-none p-1"><CheckCircle2 className="w-3 h-3" /></Badge>
                             )}
                          </div>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="glass-card border-white/10 w-48">
                      {!isOccupied ? (
                        <DropdownMenuItem className="cursor-pointer font-bold gap-2 text-emerald-500" onClick={() => { setSelectedRoom(num); setIsCheckInOpen(true); }}>
                          <Plus className="w-4 h-4" /> Guest Check-In
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <div className="p-2 border-b border-white/5 mb-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{booking.guestName}</p>
                            <p className="text-xs font-bold text-white">Out: {format(booking.checkOutDate.toDate(), "MMM dd")}</p>
                          </div>
                          <DropdownMenuItem className="cursor-pointer font-bold gap-2" onClick={() => { setActiveBooking(booking); setIsExtendOpen(true); }}>
                            <CalendarPlus className="w-4 h-4" /> Extend Stay
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer font-bold gap-2 text-destructive" onClick={() => handleCheckout(booking)}>
                            <LogOut className="w-4 h-4" /> Check Out
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </div>

        {/* Check-In Dialog */}
        <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
          <DialogContent className="glass-card border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2">
                <BedDouble className="text-primary w-5 h-5" /> Room {selectedRoom} Check-In
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCheckIn} className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Guest Full Name</Label>
                <Input name="guestName" required className="bg-white/5 border-white/10 h-11" placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Phone Number</Label>
                <Input name="phone" className="bg-white/5 border-white/10 h-11" placeholder="080 000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Stay (Days)</Label>
                  <Input name="days" type="number" min="1" required className="bg-white/5 border-white/10 h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Total Cost (₦)</Label>
                  <Input name="totalCost" type="number" required className="bg-white/5 border-white/10 h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold tracking-widest text-primary">Initial Payment (₦)</Label>
                <Input name="amountPaid" type="number" defaultValue="0" required className="bg-white/10 border-primary/20 h-12 text-lg font-bold" />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-lg">Confirm Check-In</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Extend Stay Dialog */}
        <Dialog open={isExtendOpen} onOpenChange={setIsExtendOpen}>
          <DialogContent className="glass-card border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2">
                <CalendarPlus className="text-primary w-5 h-5" /> Extend Room {activeBooking?.roomNumber}
              </DialogTitle>
            </DialogHeader>
            {activeBooking && (
              <form onSubmit={handleExtendStay} className="space-y-5 py-4">
                 <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Current Stay</p>
                  <p className="text-sm font-bold">{format(activeBooking.checkInDate.toDate(), "dd MMM")} — {format(activeBooking.checkOutDate.toDate(), "dd MMM")}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Extra Days</Label>
                    <Input name="extraDays" type="number" min="1" required className="bg-white/5 border-white/10 h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Extra Cost (₦)</Label>
                    <Input name="extraCost" type="number" defaultValue="0" required className="bg-white/5 border-white/10 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold tracking-widest text-primary">Retaining Amount Paid (₦)</Label>
                  <Input name="retainingPaid" type="number" defaultValue="0" required className="bg-white/10 border-primary/20 h-12 text-lg font-bold" />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-lg">Process Extension</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

      </AppShell>
    </RoleGuard>
  );
}
