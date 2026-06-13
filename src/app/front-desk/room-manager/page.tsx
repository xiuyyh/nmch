
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  BedDouble, 
  Plus, 
  CalendarPlus, 
  LogOut,
  MoreVertical,
  ShieldAlert,
  Home,
  ChevronRight,
  ChevronDown,
  Layers,
  CheckCircle2,
  X,
  Banknote,
  Users
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, orderBy, limit, writeBatch } from "firebase/firestore";
import { addDays, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SelectedEntity {
  apartmentId: string;
  apartmentName: string;
  roomNumber: string;
}

export default function RoomManagerPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  // UI State
  const [expandedApartments, setExpandedApartments] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<SelectedEntity[]>([]);
  
  // Dialog State
  const [selectedEntity, setSelectedEntity] = useState<{ apartment: any; roomNumber: string } | null>(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [isBulkCheckInOpen, setIsBulkCheckInOpen] = useState(false);
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
      const key = `${b.apartmentId}-${b.roomNumber}`;
      map[key] = b;
    });
    return map;
  }, [activeBookings]);

  const toggleExpansion = (id: string) => {
    const next = new Set(expandedApartments);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedApartments(next);
  };

  const isEntitySelected = (aptId: string, roomNum: string) => {
    return selectedForBulk.some(s => s.apartmentId === aptId && s.roomNumber === roomNum);
  };

  const handleEntityClick = (apt: any, roomNum: string, isOccupied: boolean) => {
    if (isOccupied) return;

    if (selectionMode) {
      if (isEntitySelected(apt.id, roomNum)) {
        setSelectedForBulk(prev => prev.filter(s => !(s.apartmentId === apt.id && s.roomNumber === roomNum)));
      } else {
        setSelectedForBulk(prev => [...prev, { apartmentId: apt.id, apartmentName: apt.name, roomNumber: roomNum }]);
      }
    } else {
      setSelectedEntity({ apartment: apt, roomNumber: roomNum });
      setIsCheckInOpen(true);
    }
  };

  const handleCheckIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !selectedEntity || !user || !activeShift) return;

    const formData = new FormData(e.currentTarget);
    const bookingData = {
      apartmentId: selectedEntity.apartment.id,
      apartmentName: selectedEntity.apartment.name,
      roomNumber: selectedEntity.roomNumber,
      guestName: formData.get("guestName") as string,
      phoneNumber: formData.get("phone") as string,
      checkInDate: serverTimestamp(),
      checkOutDate: addDays(new Date(), Number(formData.get("days"))),
      checkInAmountPaid: Number(formData.get("amountPaid")),
      retainingAmountPaid: 0,
      totalStayCost: Number(formData.get("totalCost")),
      status: "active",
      isPaid: Number(formData.get("amountPaid")) >= Number(formData.get("totalCost")),
      staffName: user.displayName || user.email,
      lastModified: serverTimestamp()
    };

    addDoc(collection(firestore, "roomBookings"), bookingData).then(() => {
      toast({ title: "Checked In", description: `${selectedEntity.apartment.name} - ${selectedEntity.roomNumber} secured.` });
      setIsCheckInOpen(false);
      setSelectedEntity(null);
    });
  };

  const handleBulkCheckIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || selectedForBulk.length === 0 || !activeShift) return;

    const formData = new FormData(e.currentTarget);
    const guestName = formData.get("guestName") as string;
    const phone = formData.get("phone") as string;
    const days = Number(formData.get("days"));
    const totalCostPerUnit = Number(formData.get("totalCostPerUnit"));
    const paidPerUnit = Number(formData.get("paidPerUnit"));

    const batch = writeBatch(firestore);
    const colRef = collection(firestore, "roomBookings");

    selectedForBulk.forEach(entity => {
      const docRef = doc(colRef);
      batch.set(docRef, {
        apartmentId: entity.apartmentId,
        apartmentName: entity.apartmentName,
        roomNumber: entity.roomNumber,
        guestName,
        phoneNumber: phone,
        checkInDate: serverTimestamp(),
        checkOutDate: addDays(new Date(), days),
        checkInAmountPaid: paidPerUnit,
        retainingAmountPaid: 0,
        totalStayCost: totalCostPerUnit,
        status: "active",
        isPaid: paidPerUnit >= totalCostPerUnit,
        staffName: user.displayName || user.email,
        lastModified: serverTimestamp()
      });
    });

    batch.commit().then(() => {
      toast({ title: "Group Check-In Complete", description: `Created ${selectedForBulk.length} bookings for ${guestName}.` });
      setIsBulkCheckInOpen(false);
      setSelectedForBulk([]);
      setSelectionMode(false);
    });
  };

  const handleCheckout = (booking: any) => {
    if (!firestore) return;
    updateDoc(doc(firestore, "roomBookings", booking.id), { 
      status: "checked_out", 
      actualCheckOutDate: serverTimestamp(),
      lastModified: serverTimestamp() 
    }).then(() => toast({ title: "Checked Out", description: "Room released." }));
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
          <h2 className="text-3xl font-headline font-bold">Front Desk Closed</h2>
          <Button asChild className="h-14 px-8 bg-primary font-bold rounded-2xl shadow-xl">
            <Link href="/front-desk/shift">Start Shift to Manage Rooms</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="space-y-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Home className="w-8 h-8 text-primary" /> Room Manager
              </h1>
              <p className="text-muted-foreground mt-1">Manage apartment stays and bulk guest bookings.</p>
            </div>

            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
              <div className="flex items-center gap-2">
                <Switch 
                  id="multi-mode" 
                  checked={selectionMode} 
                  onCheckedChange={(val) => { setSelectionMode(val); if(!val) setSelectedForBulk([]); }} 
                />
                <Label htmlFor="multi-mode" className="text-xs uppercase font-bold tracking-widest text-muted-foreground cursor-pointer">
                  Multi-Booking Mode
                </Label>
              </div>
              {selectedForBulk.length > 0 && (
                <Button 
                  size="sm" 
                  onClick={() => setIsBulkCheckInOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-4 rounded-xl gap-2 shadow-lg animate-in zoom-in-95"
                >
                  <Layers className="w-4 h-4" /> Check-In ({selectedForBulk.length} Units)
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {apartments?.map(apt => {
              const aptRooms = apt.roomNumbers || [];
              const bookingsInApt = aptRooms.map((r: string) => occupancyMap[`${apt.id}-${r}`] || occupancyMap[`${apt.id}-FULL`]).filter(Boolean);
              const isFullAptOccupied = !!occupancyMap[`${apt.id}-FULL`];
              const occupiedCount = isFullAptOccupied ? aptRooms.length : bookingsInApt.length;
              const isExpanded = expandedApartments.has(apt.id);
              const isSelectedFull = isEntitySelected(apt.id, 'FULL');

              return (
                <Collapsible 
                  key={apt.id} 
                  open={isExpanded} 
                  onOpenChange={() => toggleExpansion(apt.id)}
                  className={cn(
                    "flex flex-col gap-2 transition-all duration-300",
                    isExpanded ? "col-span-2 sm:col-span-3 md:col-span-2 lg:col-span-2" : "col-span-1"
                  )}
                >
                  <Card className={cn(
                    "glass-card border-l-4 h-32 flex flex-col justify-between transition-all cursor-pointer hover:bg-white/5",
                    occupiedCount === aptRooms.length ? "border-l-amber-500" : occupiedCount > 0 ? "border-l-primary" : "border-l-white/10",
                    isSelectedFull && "ring-2 ring-primary bg-primary/10"
                  )} onClick={(e) => {
                    if (selectionMode) {
                      e.preventDefault();
                      handleEntityClick(apt, 'FULL', isFullAptOccupied);
                    }
                  }}>
                    <div className="p-3 flex justify-between items-start">
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-headline truncate uppercase tracking-tight">{apt.name}</CardTitle>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{apt.type}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2"><MoreVertical className="w-3 h-3" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card border-white/10 w-48">
                          {!isFullAptOccupied ? (
                            <DropdownMenuItem className="font-bold text-primary gap-2" onClick={() => handleEntityClick(apt, 'FULL', false)}>
                              <Plus className="w-4 h-4" /> Book Entire Flat
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem className="font-bold gap-2" onClick={() => { setActiveBooking(occupancyMap[`${apt.id}-FULL`]); setIsExtendOpen(true); }}>
                                <CalendarPlus className="w-4 h-4" /> Extend Stay
                              </DropdownMenuItem>
                              <DropdownMenuItem className="font-bold text-destructive gap-2" onClick={() => handleCheckout(occupancyMap[`${apt.id}-FULL`])}>
                                <LogOut className="w-4 h-4" /> Check Out Flat
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="px-3 pb-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-widest",
                          occupiedCount === aptRooms.length ? "text-amber-500" : "text-muted-foreground"
                        )}>
                          {occupiedCount}/{aptRooms.length} Taken
                        </p>
                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-700" 
                            style={{ width: `${(occupiedCount/aptRooms.length)*100}%` }} 
                          />
                        </div>
                      </div>
                      <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/5 rounded-lg hover:bg-primary/20">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </Card>

                  <CollapsibleContent className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    {aptRooms.map((room: string) => {
                      const booking = occupancyMap[`${apt.id}-${room}`] || occupancyMap[`${apt.id}-FULL`];
                      const isOccupied = !!booking;
                      const isSelected = isEntitySelected(apt.id, room);
                      const isFullBooking = isOccupied && booking.roomNumber === 'FULL';

                      return (
                        <div 
                          key={room} 
                          onClick={() => !isFullBooking && handleEntityClick(apt, room, isOccupied)}
                          className={cn(
                            "p-3 rounded-xl border flex items-center justify-between transition-all group cursor-pointer",
                            isOccupied 
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                              : isSelected
                                ? "bg-primary/20 border-primary ring-1 ring-primary text-white"
                                : "bg-white/5 border-white/5 text-muted-foreground hover:border-primary/40 hover:text-white",
                            isFullBooking && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <BedDouble className={cn("w-4 h-4", isOccupied ? "opacity-100" : "opacity-30")} />
                            <span className="text-xs font-bold">{room}</span>
                          </div>
                          {isOccupied && (
                            <div className="flex items-center gap-2">
                              {!booking.isPaid && <Banknote className="w-3.5 h-3.5 text-destructive" />}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3 h-3" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="glass-card border-white/10">
                                  <DropdownMenuItem onClick={() => { setActiveBooking(booking); setIsExtendOpen(true); }}>Extend</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCheckout(booking)} className="text-destructive">Check Out</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>

        {/* Standard Check-In */}
        <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
          <DialogContent className="glass-card border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2 uppercase">
                <BedDouble className="text-primary w-5 h-5" /> 
                Check-In: {selectedEntity?.apartmentName} — {selectedEntity?.roomNumber}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCheckIn} className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Guest Name</Label>
                <Input name="guestName" required className="bg-white/5 border-white/10" placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Stay (Days)</Label>
                  <Input name="days" type="number" min="1" required className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Cost (₦)</Label>
                  <Input name="totalCost" type="number" required className="bg-white/5 border-white/10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-primary">Initial Payment (₦)</Label>
                <Input name="amountPaid" type="number" defaultValue="0" required className="bg-white/10 border-primary/20 text-lg font-bold" />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-lg">Confirm Single Stay</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Bulk Check-In */}
        <Dialog open={isBulkCheckInOpen} onOpenChange={setIsBulkCheckInOpen}>
          <DialogContent className="glass-card border-white/10 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2 uppercase">
                <Layers className="text-primary w-5 h-5" /> 
                Group Check-In ({selectedForBulk.length} Units)
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleBulkCheckIn} className="space-y-5 py-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Selected Units:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedForBulk.map((s, i) => (
                    <Badge key={i} variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px]">
                      {s.apartmentName} - {s.roomNumber}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Lead Guest Name</Label>
                <Input name="guestName" required className="bg-white/5 border-white/10 h-11" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Stay (Days)</Label>
                  <Input name="days" type="number" min="1" required className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Phone</Label>
                   <Input name="phone" className="bg-white/5 border-white/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Rate Per Unit (₦)</Label>
                  <Input name="totalCostPerUnit" type="number" required className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-primary">Paid Per Unit (₦)</Label>
                  <Input name="paidPerUnit" type="number" defaultValue="0" required className="bg-white/10 border-primary/20 font-bold" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-14 bg-primary text-primary-foreground font-bold shadow-xl">Process Group Booking</Button>
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
              <form className="space-y-5 py-4" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const extraDays = Number(formData.get("extraDays"));
                const extraCost = Number(formData.get("extraCost"));
                const retaining = Number(formData.get("retainingPaid"));
                
                const newCheckOut = addDays(activeBooking.checkOutDate.toDate(), extraDays);
                const totalNewCost = activeBooking.totalStayCost + extraCost;
                const totalPaid = activeBooking.checkInAmountPaid + activeBooking.retainingAmountPaid + retaining;

                updateDoc(doc(firestore, "roomBookings", activeBooking.id), {
                  checkOutDate: newCheckOut,
                  totalStayCost: totalNewCost,
                  retainingAmountPaid: activeBooking.retainingAmountPaid + retaining,
                  isPaid: totalPaid >= totalNewCost,
                  lastModified: serverTimestamp()
                }).then(() => {
                  toast({ title: "Stay Extended", description: "Record updated." });
                  setIsExtendOpen(false);
                });
              }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Extra Days</Label>
                    <Input name="extraDays" type="number" min="1" required className="bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Extra Cost (₦)</Label>
                    <Input name="extraCost" type="number" required className="bg-white/5" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold tracking-widest text-primary">Retaining Amount Paid (₦)</Label>
                  <Input name="retainingPaid" type="number" defaultValue="0" className="bg-white/10 border-primary/20 font-bold" />
                </div>
                <DialogFooter><Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-bold">Update Record</Button></DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

      </AppShell>
    </RoleGuard>
  );
}

