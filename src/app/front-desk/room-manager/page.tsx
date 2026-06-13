
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Users,
  Search,
  History,
  Phone,
  Clock,
  ChevronLeft,
  AlertTriangle
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

const HISTORY_PER_PAGE = 5;

export default function RoomManagerPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  // UI State
  const [activeTab, setActiveTab] = useState("grid");
  const [expandedApartments, setExpandedApartments] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<SelectedEntity[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog State
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
  const activeBookingsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "roomBookings"), where("status", "==", "active"), orderBy("checkInDate", "desc"));
  }, [firestore]);
  const { data: activeBookings, loading: bookingsLoading } = useCollection(activeBookingsQuery);

  // 4. Fetch Booking History (for the history tab)
  const historyQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "roomBookings"), 
      where("status", "==", "checked_out"),
      orderBy("checkInDate", "desc"),
      limit(50)
    );
  }, [firestore]);
  const { data: historyBookings, loading: historyLoading } = useCollection(historyQuery);

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

  const handleCheckout = (booking: any) => {
    if (!firestore) return;
    updateDoc(doc(firestore, "roomBookings", booking.id), { 
      status: "checked_out", 
      actualCheckOutDate: serverTimestamp(),
      lastModified: serverTimestamp() 
    }).then(() => toast({ title: "Checked Out", description: "Room released." }));
  };

  const filteredOccupancy = useMemo(() => {
    if (!activeBookings) return [];
    return activeBookings.filter(b => 
      b.guestName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.apartmentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeBookings, searchQuery]);

  const paginatedHistory = useMemo(() => {
    if (!historyBookings) return [];
    const start = (historyPage - 1) * HISTORY_PER_PAGE;
    return historyBookings.slice(start, start + HISTORY_PER_PAGE);
  }, [historyBookings, historyPage]);

  const historyTotalPages = Math.max(1, Math.ceil((historyBookings?.length || 0) / HISTORY_PER_PAGE));

  if (shiftLoading || aptLoading || bookingsLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse text-muted-foreground font-bold uppercase tracking-widest">Syncing Hospitality Grid...</div></AppShell>;
  }

  if (!activeShift) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-3xl font-headline font-bold uppercase">Front Desk Closed</h2>
          <Button asChild className="h-14 px-8 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl text-lg">
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
              <p className="text-muted-foreground mt-1">Real-time apartment occupancy and guest billing control.</p>
            </div>

            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
              <div className="flex items-center gap-2">
                <Switch 
                  id="multi-mode" 
                  checked={selectionMode} 
                  onCheckedChange={(val) => { setSelectionMode(val); if(!val) setSelectedForBulk([]); }} 
                />
                <Label htmlFor="multi-mode" className="text-xs uppercase font-bold tracking-widest text-muted-foreground cursor-pointer">
                  Group Selection
                </Label>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="bg-white/5 border border-white/10 p-1 h-12 w-full sm:w-fit">
              <TabsTrigger value="grid" className="flex-1 sm:flex-none gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs uppercase tracking-widest">
                <BedDouble className="w-4 h-4" /> Room Grid
              </TabsTrigger>
              <TabsTrigger value="occupancy" className="flex-1 sm:flex-none gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs uppercase tracking-widest">
                <Users className="w-4 h-4" /> Occupancy List
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 sm:flex-none gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs uppercase tracking-widest">
                <History className="w-4 h-4" /> Stay History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grid" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {apartments?.map(apt => {
                  const aptRooms = apt.roomNumbers || [];
                  const bookingsInApt = aptRooms.map((r: string) => occupancyMap[`${apt.id}-${r}`] || occupancyMap[`${apt.id}-FULL`]).filter(Boolean);
                  const isFullAptOccupied = !!occupancyMap[`${apt.id}-FULL`];
                  const occupiedCount = isFullAptOccupied ? aptRooms.length : bookingsInApt.length;
                  const isExpanded = expandedApartments.has(apt.id);

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
                        occupiedCount === aptRooms.length ? "border-l-amber-500" : occupiedCount > 0 ? "border-l-primary" : "border-l-white/10"
                      )} onClick={() => toggleExpansion(apt.id)}>
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
                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/5 rounded-lg hover:bg-primary/20">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                        </div>
                      </Card>

                      <CollapsibleContent className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                        {aptRooms.map((room: string) => {
                          const booking = occupancyMap[`${apt.id}-${room}`] || occupancyMap[`${apt.id}-FULL`];
                          const isOccupied = !!booking;
                          const isFullBooking = isOccupied && booking.roomNumber === 'FULL';

                          return (
                            <div 
                              key={room} 
                              onClick={() => !isFullBooking && handleEntityClick(apt, room, isOccupied)}
                              className={cn(
                                "p-3 rounded-xl border flex items-center justify-between transition-all group cursor-pointer",
                                isOccupied 
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
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
                                  {!booking.isPaid && <Badge variant="destructive" className="h-5 text-[8px] uppercase px-1">Unpaid</Badge>}
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
            </TabsContent>

            <TabsContent value="occupancy" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <Card className="glass-card">
                 <CardHeader className="border-b border-white/5 pb-4">
                   <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                     <CardTitle className="text-xl font-headline flex items-center gap-2">
                       <Users className="w-5 h-5 text-primary" /> Active Guests
                     </CardTitle>
                     <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search guest or flat..." 
                          className="pl-10 h-10 bg-white/5 border-white/10 rounded-xl"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                      {filteredOccupancy.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground italic">No active guests found.</div>
                      ) : filteredOccupancy.map(b => (
                        <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                              <Users className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-white uppercase text-sm">{b.guestName}</span>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                <BedDouble className="w-3 h-3" /> {b.apartmentName} — {b.roomNumber}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Phone</span>
                              <span className="text-xs font-bold text-white flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {b.phoneNumber || "N/A"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Check-Out</span>
                              <span className="text-xs font-bold text-white flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {b.checkOutDate?.toDate ? format(b.checkOutDate.toDate(), "dd MMM, yyyy") : "N/A"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Payment Status</span>
                              {b.isPaid ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] uppercase w-fit">Paid & Secured</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[9px] uppercase w-fit">Balance Pending</Badge>
                              )}
                            </div>
                            <div className="flex justify-end">
                              <Button variant="ghost" size="icon" onClick={() => { setActiveBooking(b); setIsExtendOpen(true); }} className="hover:text-primary"><CalendarPlus className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleCheckout(b)} className="hover:text-destructive"><LogOut className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                 </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value="history" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <Card className="glass-card">
                 <CardHeader className="border-b border-white/5">
                   <CardTitle className="text-xl font-headline flex items-center gap-2">
                     <History className="w-5 h-5 text-primary" /> Stay Archive
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                      {historyLoading ? (
                        <div className="py-20 text-center animate-pulse">Loading history...</div>
                      ) : paginatedHistory.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground italic">No checked-out stays found.</div>
                      ) : paginatedHistory.map(b => (
                        <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground">
                              <Users className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-white uppercase text-xs">{b.guestName}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">{b.apartmentName} — {b.roomNumber}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 items-center">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Duration</span>
                              <span className="text-xs text-white/80">
                                {b.checkInDate?.toDate ? format(b.checkInDate.toDate(), "dd/MM") : "?"} - {b.actualCheckOutDate?.toDate ? format(b.actualCheckOutDate.toDate(), "dd/MM") : "?"}
                              </span>
                            </div>
                            <div className="flex flex-col">
                               <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Revenue</span>
                               <span className="text-xs font-bold text-primary">₦{b.totalStayCost?.toLocaleString()}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] uppercase tracking-widest justify-center">Checked Out</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                 </CardContent>
                 {historyTotalPages > 1 && (
                   <div className="flex items-center justify-between p-4 border-t border-white/5">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Page {historyPage} of {historyTotalPages}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="h-9 px-4 rounded-xl border-white/10"><ChevronLeft className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages} className="h-9 px-4 rounded-xl border-white/10"><ChevronRight className="w-4 h-4" /></Button>
                      </div>
                   </div>
                 )}
               </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Standard Check-In */}
        <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
          <DialogContent className="glass-card border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2 uppercase">
                <BedDouble className="text-primary w-5 h-5" /> 
                Check-In: {selectedEntity?.apartment.name} — {selectedEntity?.roomNumber}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCheckIn} className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Guest Name</Label>
                <Input name="guestName" required className="bg-white/5 border-white/10" placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Phone Number</Label>
                <Input name="phone" className="bg-white/5 border-white/10" placeholder="+234..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Stay (Days)</Label>
                  <Input name="days" type="number" min="1" required className="bg-white/5 border-white/10" defaultValue="1" />
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
                <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-lg uppercase tracking-widest text-xs">Confirm Entry</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Extend Stay Dialog */}
        <Dialog open={isExtendOpen} onOpenChange={setIsExtendOpen}>
          <DialogContent className="glass-card border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2 uppercase">
                <CalendarPlus className="text-primary w-5 h-5" /> Extend Stay (Retaining)
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
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <span>Current Balance:</span>
                    <span className={cn(activeBooking.isPaid ? "text-emerald-500" : "text-destructive")}>
                      ₦{(activeBooking.totalStayCost - (activeBooking.checkInAmountPaid + activeBooking.retainingAmountPaid)).toLocaleString()}
                    </span>
                  </div>
                  {!activeBooking.isPaid && (
                    <Badge variant="destructive" className="w-full justify-center py-1 text-[9px] uppercase tracking-widest gap-2">
                      <AlertTriangle className="w-3 h-3" /> Guest Has Unpaid Balance
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Extra Days</Label>
                    <Input name="extraDays" type="number" min="1" required className="bg-white/5 border-white/10" defaultValue="1" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Extra Cost (₦)</Label>
                    <Input name="extraCost" type="number" required className="bg-white/5 border-white/10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-primary">Payment for Extension (₦)</Label>
                  <Input name="retainingPaid" type="number" defaultValue="0" className="bg-white/10 border-primary/20 font-bold h-12 text-lg" />
                </div>
                <div className="flex gap-2">
                   <Button type="button" variant="outline" className="flex-1 border-destructive/20 text-destructive font-bold uppercase text-[10px] tracking-widest h-12" onClick={() => setIsExtendOpen(false)}>
                     Cancel
                   </Button>
                   <Button type="submit" className="flex-[2] h-12 bg-primary text-primary-foreground font-bold uppercase text-[10px] tracking-widest shadow-xl">
                     Update Guest Stay
                   </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

      </AppShell>
    </RoleGuard>
  );
}
