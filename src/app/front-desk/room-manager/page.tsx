
"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  CheckCircle2,
  Users,
  Search,
  History,
  Phone,
  Clock,
  ChevronLeft,
  Banknote,
  LayoutGrid,
  Loader2
} from "lucide-react";
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
import { collection, query, where, serverTimestamp, doc, updateDoc, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

interface SelectedEntity {
  apartmentId: string;
  apartmentName: string;
  roomNumber: string;
}

const HISTORY_PER_PAGE = 5;

export default function RoomManagerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState(searchParams.get("activeTab") || "grid");
  const [expandedApartments, setExpandedApartments] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(searchParams.get("selectionMode") === "true");
  const [selectedForBulk, setSelectedForBulk] = useState<SelectedEntity[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (searchParams.get("selectionMode") === "true") {
      setSelectionMode(true);
    }
    if (searchParams.get("activeTab")) {
      setActiveTab(searchParams.get("activeTab")!);
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

  const apartmentsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "apartments"), orderBy("name"));
  }, [firestore]);
  const { data: apartments, loading: aptLoading } = useCollection(apartmentsQuery);

  const activeBookingsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "roomBookings"), where("status", "==", "active"), orderBy("checkInDate", "desc"));
  }, [firestore]);
  const { data: activeBookings, loading: bookingsLoading } = useCollection(activeBookingsQuery);

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

  const groupedOccupancy = useMemo(() => {
    if (!activeBookings) return [];
    
    const groups: Record<string, any[]> = {};
    activeBookings.forEach(b => {
      const key = `${b.guestName?.trim()}-${b.phoneNumber?.trim()}`.toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });

    const result = Object.values(groups).map(bookings => {
      const first = bookings[0];
      const rooms = bookings.map(b => `${b.apartmentName} — ${b.roomNumber}`).join(', ');
      const totalCost = bookings.reduce((sum, b) => sum + (b.totalStayCost || 0), 0);
      const totalPaid = bookings.reduce((sum, b) => sum + (b.checkInAmountPaid || 0) + (b.retainingAmountPaid || 0), 0);
      const isPaid = totalPaid >= totalCost;
      const ids = bookings.map(b => b.id).join(',');
      
      return {
        ...first,
        id: first.id,
        roomDisplay: rooms,
        totalGroupCost: totalCost,
        totalGroupPaid: totalPaid,
        isGroupPaid: isPaid,
        allBookingIds: ids,
        allBookings: bookings
      };
    });

    return result.filter(g => 
      g.guestName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.roomDisplay?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeBookings, searchQuery]);

  const toggleExpansion = (id: string) => {
    const next = new Set(expandedApartments);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedApartments(next);
  };

  const handleEntityClick = (apt: any, roomNum: string, isOccupied: boolean) => {
    if (isOccupied) return;

    if (selectionMode) {
      const isSelected = selectedForBulk.some(s => s.apartmentId === apt.id && s.roomNumber === roomNum);
      if (isSelected) {
        setSelectedForBulk(prev => prev.filter(s => !(s.apartmentId === apt.id && s.roomNumber === roomNum)));
      } else {
        setSelectedForBulk(prev => [...prev, { apartmentId: apt.id, apartmentName: apt.name, roomNumber: roomNum }]);
      }
    } else {
      const rooms = [{ apartmentId: apt.id, apartmentName: apt.name, roomNumber: roomNum }];
      const params = new URLSearchParams();
      params.set("rooms", JSON.stringify(rooms));
      
      const gName = searchParams.get("guestName");
      const gPhone = searchParams.get("phoneNumber");
      if(gName) params.set("guestName", gName);
      if(gPhone) params.set("phoneNumber", gPhone);

      router.push(`/front-desk/check-in?${params.toString()}`);
    }
  };

  const handleCheckout = (booking: any) => {
    if (!firestore) return;
    updateDoc(doc(firestore, "roomBookings", booking.id), { 
      status: "checked_out", 
      actualCheckOutDate: serverTimestamp(),
      lastModified: serverTimestamp() 
    }).then(() => {
      toast({ title: "Checked Out", description: "Room released." });
    }).catch(err => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: `roomBookings/${booking.id}`,
        operation: "update",
        requestResourceData: { status: "checked_out" }
      }));
    });
  };

  const handleBatchCheckIn = () => {
    if (selectedForBulk.length === 0) return;
    const params = new URLSearchParams();
    params.set("rooms", JSON.stringify(selectedForBulk));
    
    const gName = searchParams.get("guestName");
    const gPhone = searchParams.get("phoneNumber");
    if(gName) params.set("guestName", gName);
    if(gPhone) params.set("phoneNumber", gPhone);

    router.push(`/front-desk/check-in?${params.toString()}`);
  };

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
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 p-4">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-headline font-bold uppercase">Front Desk Closed</h2>
          <Button asChild className="h-14 px-8 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl text-lg w-full max-w-xs">
            <Link href="/front-desk/shift">Start Shift</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Home className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> Room Manager
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Real-time apartment occupancy and guest billing.</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/10 p-3 sm:px-4 rounded-2xl w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-3">
                <Switch id="multi-select" checked={selectionMode} onCheckedChange={(val) => { setSelectionMode(val); setSelectedForBulk([]); }} />
                <Label htmlFor="multi-select" className="text-[10px] uppercase font-bold tracking-widest cursor-pointer">Multi-Select</Label>
              </div>
              {selectionMode && selectedForBulk.length > 0 && (
                <Button onClick={handleBatchCheckIn} className="bg-primary text-primary-foreground font-bold h-10 px-6 rounded-xl animate-in zoom-in duration-300 w-full sm:w-auto">
                   Check-In {selectedForBulk.length}
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white/5 border border-white/10 p-1 h-12 w-full flex overflow-x-auto overflow-y-hidden custom-scrollbar">
              <TabsTrigger value="grid" className="flex-1 gap-2 px-3 sm:px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap">
                <LayoutGrid className="w-4 h-4 hidden sm:block" /> Grid
              </TabsTrigger>
              <TabsTrigger value="occupancy" className="flex-1 gap-2 px-3 sm:px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap">
                <Users className="w-4 h-4 hidden sm:block" /> Active
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 gap-2 px-3 sm:px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap">
                <History className="w-4 h-4 hidden sm:block" /> History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grid" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
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
                        isExpanded ? "col-span-2 sm:col-span-3 md:col-span-2" : "col-span-1"
                      )}
                    >
                      <Card className={cn(
                        "glass-card border-l-4 h-28 sm:h-32 flex flex-col justify-between transition-all cursor-pointer hover:bg-white/5",
                        occupiedCount === aptRooms.length ? "border-l-amber-500" : occupiedCount > 0 ? "border-l-primary" : "border-l-white/10"
                      )} onClick={() => toggleExpansion(apt.id)}>
                        <div className="p-2 sm:p-3 flex justify-between items-start">
                          <div className="min-w-0">
                            <CardTitle className="text-xs sm:text-sm font-headline truncate uppercase tracking-tight">{apt.name}</CardTitle>
                            <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase">{apt.type}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1"><MoreVertical className="w-3 h-3" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-card border-white/10 w-48">
                              {!isFullAptOccupied ? (
                                <DropdownMenuItem className="font-bold text-primary gap-2" onClick={() => handleEntityClick(apt, 'FULL', false)}>
                                  <Plus className="w-4 h-4" /> Book Entire Flat
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem className="font-bold gap-2" asChild>
                                    <Link href={`/front-desk/extend?ids=${occupancyMap[`${apt.id}-FULL`].id}`}>
                                      <CalendarPlus className="w-4 h-4" /> Extend Stay
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="font-bold text-destructive gap-2" onClick={() => handleCheckout(occupancyMap[`${apt.id}-FULL`])}>
                                    <LogOut className="w-4 h-4" /> Check Out Flat
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="px-2 sm:p-3 pb-2 sm:pb-3 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className={cn(
                              "text-[8px] sm:text-[10px] font-bold uppercase tracking-widest",
                              occupiedCount === aptRooms.length ? "text-amber-500" : "text-muted-foreground"
                            )}>
                              {occupiedCount}/{aptRooms.length}
                            </p>
                            <div className="w-10 sm:w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="bg-primary h-full transition-all duration-700" 
                                style={{ width: `${(occupiedCount/aptRooms.length)*100}%` }} 
                              />
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 bg-white/5 rounded-lg">
                            {isExpanded ? <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-primary" /> : <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />}
                          </Button>
                        </div>
                      </Card>

                      <CollapsibleContent className="space-y-1 sm:space-y-2 animate-in slide-in-from-top-2 duration-300">
                        {aptRooms.map((room: string) => {
                          const booking = occupancyMap[`${apt.id}-${room}`] || occupancyMap[`${apt.id}-FULL`];
                          const isOccupied = !!booking;
                          const isFullBooking = isOccupied && booking.roomNumber === 'FULL';
                          const isSelected = selectedForBulk.some(s => s.apartmentId === apt.id && s.roomNumber === room);

                          return (
                            <div 
                              key={room} 
                              onClick={() => !isFullBooking && handleEntityClick(apt, room, isOccupied)}
                              className={cn(
                                "p-2 sm:p-3 rounded-xl border flex items-center justify-between transition-all group cursor-pointer",
                                isOccupied 
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                                  : isSelected 
                                    ? "bg-primary/20 border-primary/40 text-primary"
                                    : "bg-white/5 border-white/5 text-muted-foreground hover:border-primary/40 hover:text-white",
                                isFullBooking && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className="flex items-center gap-2 sm:gap-3">
                                <BedDouble className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", isOccupied || isSelected ? "opacity-100" : "opacity-30")} />
                                <span className="text-[10px] sm:text-xs font-bold">{room}</span>
                              </div>
                              {isOccupied && (
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  {!booking.isPaid && <Badge variant="destructive" className="h-4 sm:h-5 text-[7px] sm:text-[8px] uppercase px-1">Debt</Badge>}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3 h-3" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="glass-card border-white/10">
                                      <DropdownMenuItem asChild>
                                        <Link href={`/front-desk/extend?ids=${booking.id}`}>Extend</Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleCheckout(booking)} className="text-destructive">Check Out</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                              {isSelected && !isOccupied && <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />}
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
                 <CardHeader className="border-b border-white/5 pb-4 px-4 sm:px-6">
                   <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                     <CardTitle className="text-lg sm:text-xl font-headline flex items-center gap-2">
                       <Users className="w-5 h-5 text-primary" /> Active Stays
                     </CardTitle>
                     <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search..." 
                          className="pl-10 h-10 bg-white/5 border-white/10 rounded-xl text-sm"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                      {groupedOccupancy.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground italic text-sm">No active stays found.</div>
                      ) : groupedOccupancy.map(g => (
                        <div key={g.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-white/[0.01] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-white uppercase text-sm truncate">{g.guestName}</span>
                              <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                <BedDouble className="w-3 h-3 shrink-0" /> <span className="truncate">{g.roomDisplay}</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 items-center flex-1 sm:flex-none">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Phone</span>
                              <span className="text-[10px] sm:text-xs font-bold text-white flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {g.phoneNumber || "N/A"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Check-Out</span>
                              <span className="text-[10px] sm:text-xs font-bold text-white flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {g.checkOutDate?.toDate ? format(g.checkOutDate.toDate(), "dd MMM") : "N/A"}</span>
                            </div>
                            <div className="flex flex-col col-span-1">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Balance</span>
                              {g.isGroupPaid ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] sm:text-[9px] uppercase w-fit px-1.5 h-5">Paid</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[8px] sm:text-[9px] uppercase w-fit px-1.5 h-5">₦{(g.totalGroupCost - g.totalGroupPaid).toLocaleString()}</Badge>
                              )}
                            </div>
                            <div className="flex justify-end col-span-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-white/10 bg-white/5">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="glass-card border-white/10 w-48">
                                  <DropdownMenuItem asChild className="gap-2 font-bold py-3 cursor-pointer">
                                    <Link href={`/front-desk/extend?ids=${g.allBookingIds}`}>
                                      <CalendarPlus className="w-4 h-4 text-primary" /> Extend Stay
                                    </Link>
                                  </DropdownMenuItem>
                                  {!g.isGroupPaid && (
                                    <DropdownMenuItem asChild className="gap-2 font-bold py-3 text-emerald-500 cursor-pointer">
                                      <Link href={`/front-desk/settle?ids=${g.allBookingIds}`}>
                                        <Banknote className="w-4 h-4" /> Settle Balance
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                 <CardHeader className="border-b border-white/5 px-4 sm:px-6">
                   <CardTitle className="text-lg sm:text-xl font-headline flex items-center gap-2">
                     <History className="w-5 h-5 text-primary" /> Stay Archive
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                      {historyLoading ? (
                        <div className="py-20 text-center animate-pulse text-sm">Loading history...</div>
                      ) : paginatedHistory.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground italic text-sm">No historical stays found.</div>
                      ) : paginatedHistory.map(b => (
                        <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground shrink-0">
                              <Users className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-white uppercase text-xs truncate">{b.guestName}</span>
                              <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase truncate">{b.apartmentName} — {b.roomNumber}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-center">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">Stay Period</span>
                              <span className="text-[10px] text-white/80">
                                {b.checkInDate?.toDate ? format(b.checkInDate.toDate(), "dd/MM") : "?"} - {b.actualCheckOutDate?.toDate ? format(b.actualCheckOutDate.toDate(), "dd/MM") : "?"}
                              </span>
                            </div>
                            <div className="flex flex-col">
                               <span className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">Value</span>
                               <span className="text-[10px] font-bold text-primary">₦{b.totalStayCost?.toLocaleString()}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] uppercase tracking-widest justify-center h-5 px-1 bg-white/5 border-white/10 hidden sm:flex">Archived</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                 </CardContent>
                 {historyTotalPages > 1 && (
                   <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-white/5 gap-4">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Page {historyPage} of {historyTotalPages}</p>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="h-10 px-4 rounded-xl border-white/10 flex-1 sm:flex-none"><ChevronLeft className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages} className="h-10 px-4 rounded-xl border-white/10 flex-1 sm:flex-none"><ChevronRight className="w-4 h-4" /></Button>
                      </div>
                   </div>
                 )}
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
