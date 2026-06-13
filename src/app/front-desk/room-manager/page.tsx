
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
  CalendarPlus,
  Home,
  ChevronRight,
  Users
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
import Link from "next/link";

export default function RoomManagerPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [selectedEntity, setSelectedEntity] = useState<{ apartment: any; roomNumber: string } | null>(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<any>(null);

  // 1. Shift Check
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

  // 2. Fetch Apartments Config
  const apartmentsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "apartments"), orderBy("name"));
  }, [firestore]);
  const { data: apartments, loading: aptLoading } = useCollection(apartmentsQuery);

  // 3. Fetch All Active Bookings
  const bookingsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "roomBookings"), where("status", "==", "active"));
  }, [firestore]);
  const { data: activeBookings, loading: bookingsLoading } = useCollection(bookingsQuery);

  const occupancyMap = useMemo(() => {
    if (!activeBookings) return {};
    const map: Record<string, any> = {};
    activeBookings.forEach(b => {
      // Map both specific rooms and the whole apartment
      const key = `${b.apartmentId}-${b.roomNumber}`;
      map[key] = b;
    });
    return map;
  }, [activeBookings]);

  const isRoomOccupied = (aptId: string, roomNumber: string) => {
    // Check if the specific room is booked
    if (occupancyMap[`${aptId}-${roomNumber}`]) return occupancyMap[`${aptId}-${roomNumber}`];
    // Check if the whole apartment is booked
    if (occupancyMap[`${aptId}-FULL`]) return occupancyMap[`${aptId}-FULL`];
    return null;
  };

  const handleCheckIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !selectedEntity || !user || !activeShift) return;

    const formData = new FormData(e.currentTarget);
    const guestName = formData.get("guestName") as string;
    const phone = formData.get("phone") as string;
    const days = Number(formData.get("days"));
    const amountPaid = Number(formData.get("amountPaid"));
    const totalCost = Number(formData.get("totalCost"));

    const bookingData = {
      apartmentId: selectedEntity.apartment.id,
      apartmentName: selectedEntity.apartment.name,
      roomNumber: selectedEntity.roomNumber,
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
        toast({ title: "Checked In", description: `Successfully booked ${selectedEntity.roomNumber === 'FULL' ? 'Entire' : ''} ${selectedEntity.apartment.name}.` });
        setIsCheckInOpen(false);
        setSelectedEntity(null);
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
      toast({ title: "Stay Extended", description: "Record updated successfully." });
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
      toast({ title: "Checked Out", description: "Session finalized and room released." });
    });
  };

  if (shiftLoading || aptLoading || bookingsLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse">Syncing Hospitality Grid...</div></AppShell>;
  }

  if (!activeShift) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-headline font-bold">Front Desk Closed</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Please start your shift to manage apartments.</p>
          </div>
          <Button asChild className="h-14 px-8 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl">
            <Link href="/front-desk/shift">Open Shift Management</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (apartments?.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Home className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-headline font-bold">No Apartments Configured</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Please set up your flats in the Apartment Setup section.</p>
          </div>
          <Button asChild variant="outline" className="h-14 px-8 rounded-2xl">
            <Link href="/front-desk/setup">Go to Setup</Link>
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
                <Home className="w-8 h-8 text-primary" /> Room Manager
              </h1>
              <p className="text-muted-foreground mt-1">Hierarchical Apartment Grid. Manage flats and individual rooms.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {apartments?.map(apt => {
              const isFullAptOccupied = !!occupancyMap[`${apt.id}-FULL`];
              const fullAptBooking = occupancyMap[`${apt.id}-FULL`];
              
              return (
                <Card key={apt.id} className={cn(
                  "glass-card border-l-4 transition-all duration-500",
                  isFullAptOccupied ? "border-l-amber-500" : "border-l-primary/40"
                )}>
                  <CardHeader className="p-4 flex flex-row items-center justify-between bg-white/[0.02] border-b border-white/5">
                    <div>
                      <CardTitle className="text-base font-headline">{apt.name}</CardTitle>
                      <Badge variant="outline" className="text-[8px] uppercase px-1 h-4 border-white/10">{apt.type}</Badge>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-card border-white/10 w-48">
                        {!isFullAptOccupied ? (
                          <DropdownMenuItem className="cursor-pointer font-bold gap-2 text-primary" onClick={() => { setSelectedEntity({ apartment: apt, roomNumber: 'FULL' }); setIsCheckInOpen(true); }}>
                            <Plus className="w-4 h-4" /> Book Entire Flat
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <div className="p-2 border-b border-white/5 mb-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">WHOLE FLAT BOOKED</p>
                              <p className="text-xs font-bold text-white truncate">{fullAptBooking.guestName}</p>
                            </div>
                            <DropdownMenuItem className="cursor-pointer font-bold gap-2" onClick={() => { setActiveBooking(fullAptBooking); setIsExtendOpen(true); }}>
                              <CalendarPlus className="w-4 h-4" /> Extend Stay
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer font-bold gap-2 text-destructive" onClick={() => handleCheckout(fullAptBooking)}>
                              <LogOut className="w-4 h-4" /> Check Out Flat
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 gap-2">
                      {apt.roomNumbers.map((room: string) => {
                        const booking = isRoomOccupied(apt.id, room);
                        const isOccupied = !!booking;
                        const hasDebt = isOccupied && !booking.isPaid;
                        const isWholeFlatBooking = isOccupied && booking.roomNumber === 'FULL';

                        return (
                          <div key={room} className="relative">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button disabled={isWholeFlatBooking} className={cn(
                                  "w-full p-3 rounded-xl border flex items-center justify-between transition-all group",
                                  isOccupied 
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                                    : "bg-white/5 border-white/5 text-muted-foreground hover:border-primary/40 hover:text-white"
                                )}>
                                  <div className="flex items-center gap-3">
                                    <BedDouble className={cn("w-4 h-4", isOccupied ? "opacity-100" : "opacity-30")} />
                                    <span className="text-sm font-bold">{room}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isOccupied && (
                                      <>
                                        {hasDebt && <Badge className="h-4 bg-destructive text-white border-none p-1"><Banknote className="w-3 h-3" /></Badge>}
                                        <ChevronRight className="w-3 h-3 opacity-30" />
                                      </>
                                    )}
                                  </div>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="glass-card border-white/10 w-48">
                                {!isOccupied ? (
                                  <DropdownMenuItem className="cursor-pointer font-bold gap-2 text-emerald-500" onClick={() => { setSelectedEntity({ apartment: apt, roomNumber: room }); setIsCheckInOpen(true); }}>
                                    <Plus className="w-4 h-4" /> Room Check-In
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Check-In Dialog */}
        <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
          <DialogContent className="glass-card border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2">
                <BedDouble className="text-primary w-5 h-5" /> 
                {selectedEntity?.roomNumber === 'FULL' ? `Entire ${selectedEntity?.apartment.name}` : `Room ${selectedEntity?.roomNumber}`} Check-In
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
                <CalendarPlus className="text-primary w-5 h-5" /> Extend Stay
              </DialogTitle>
            </DialogHeader>
            {activeBooking && (
              <form onSubmit={handleExtendStay} className="space-y-5 py-4">
                 <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Unit</p>
                  <p className="text-sm font-bold">{activeBooking.apartmentName} - {activeBooking.roomNumber === 'FULL' ? 'WHOLE' : activeBooking.roomNumber}</p>
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
