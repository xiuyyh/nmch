
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CalendarPlus, 
  ChevronLeft, 
  Save, 
  User, 
  BedDouble, 
  Banknote,
  AlertCircle,
  Loader2,
  Clock,
  Info,
  LogOut,
  PlusCircle
} from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { addDays, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ExtendStayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const bookingIds = useMemo(() => searchParams.get("ids")?.split(",") || [], [searchParams]);

  useEffect(() => {
    if (!firestore || bookingIds.length === 0) {
      if (bookingIds.length === 0) router.replace("/front-desk/room-manager");
      return;
    }

    const fetchBookings = async () => {
      try {
        const results = await Promise.all(
          bookingIds.map(id => getDoc(doc(firestore, "roomBookings", id)))
        );
        const data = results.map(snap => ({ id: snap.id, ...snap.data() }));
        setBookings(data);
        // Select all by default
        setSelectedIds(new Set(data.map(d => d.id)));
      } catch (e) {
        toast({ variant: "destructive", title: "Load Error", description: "Failed to fetch booking details." });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, [firestore, bookingIds, router, toast]);

  const guestInfo = bookings[0] || {};
  const totalGroupCost = bookings.reduce((sum, b) => sum + (b.totalStayCost || 0), 0);
  const totalGroupPaid = bookings.reduce((sum, b) => sum + (b.checkInAmountPaid || 0) + (b.retainingAmountPaid || 0), 0);
  const currentBalance = totalGroupCost - totalGroupPaid;

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleCheckout = (bookingId: string) => {
    if (!firestore) return;
    updateDoc(doc(firestore, "roomBookings", bookingId), { 
      status: "checked_out", 
      actualCheckOutDate: serverTimestamp(),
      lastModified: serverTimestamp() 
    }).then(() => {
      toast({ title: "Checked Out", description: "Room released successfully." });
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      if (bookings.length <= 1) router.push("/front-desk/room-manager");
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || selectedIds.size === 0 || isSubmitting) {
       if(selectedIds.size === 0) toast({ variant: "destructive", title: "Selection Required", description: "Please select at least one room to extend." });
       return;
    }

    const formData = new FormData(e.currentTarget);
    const extraDays = Number(formData.get("extraDays"));
    const extraCost = Number(formData.get("extraCost"));
    const declaringPaid = Number(formData.get("declaringPaid"));
    const paymentStatus = formData.get("paymentStatus");

    setIsSubmitting(true);

    try {
      // We apply extension only to selected IDs
      // But payment is distributed across the WHOLE group for financial consistency
      const perRoomExtraCost = extraCost / selectedIds.size;
      const perRoomNewPayment = declaringPaid / bookings.length;

      const promises = bookings.map(b => {
        const isSelected = selectedIds.has(b.id);
        const updateData: any = {
          retainingAmountPaid: (b.retainingAmountPaid || 0) + perRoomNewPayment,
          lastModified: serverTimestamp()
        };

        if (isSelected) {
          const newCheckOut = addDays(b.checkOutDate.toDate(), extraDays);
          updateData.checkOutDate = newCheckOut;
          updateData.totalStayCost = (b.totalStayCost || 0) + perRoomExtraCost;
        }

        // Re-check overall payment status for this record
        const totalNewCost = isSelected ? (b.totalStayCost || 0) + perRoomExtraCost : (b.totalStayCost || 0);
        const totalNewPaid = (b.checkInAmountPaid || 0) + (b.retainingAmountPaid || 0) + perRoomNewPayment;
        updateData.isPaid = paymentStatus === 'paid' || totalNewPaid >= totalNewCost;

        return updateDoc(doc(firestore, "roomBookings", b.id), updateData);
      });

      await Promise.all(promises);
      toast({ title: "Extension Finalized", description: `Updated ${selectedIds.size} units for ${extraDays} more days.` });
      router.push("/front-desk/room-manager");
    } catch (error) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not finalize stay extension." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMoreUnits = () => {
    const params = new URLSearchParams();
    params.set("activeTab", "grid");
    params.set("selectionMode", "true");
    params.set("guestName", guestInfo.guestName);
    params.set("phoneNumber", guestInfo.phoneNumber);
    router.push(`/front-desk/room-manager?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <RoleGuard allowedRoles={["front_desk", "admin"]}>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/5">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Modify Stay</h1>
                <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">
                  Guest: {guestInfo.guestName}
                </p>
              </div>
            </div>
            
            <Button onClick={handleAddMoreUnits} className="bg-emerald-600 hover:bg-emerald-700 h-12 px-6 rounded-xl gap-2 font-bold shadow-lg">
              <PlusCircle className="w-5 h-5" /> Add More Rooms
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <CalendarPlus className="text-primary w-5 h-5" /> Stay Extension Parameters
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-8 pt-6">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Consolidated Balance</span>
                        <span className={cn("text-2xl font-headline font-bold", currentBalance <= 0 ? "text-emerald-500" : "text-destructive")}>
                          ₦{currentBalance.toLocaleString()}
                        </span>
                      </div>
                      <Badge variant="outline" className={cn(
                        "h-8 uppercase font-bold text-[10px]",
                        currentBalance <= 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                      )}>
                        {currentBalance <= 0 ? "Fully Paid" : "Unpaid Balance"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Extension Duration (Days)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input name="extraDays" type="number" min="1" required defaultValue="1" className="bg-white/5 h-12 pl-10" />
                        </div>
                        <p className="text-[9px] text-muted-foreground italic">Applies only to selected units.</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Combined Extension Cost (₦)</Label>
                        <div className="relative">
                          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input name="extraCost" type="number" required defaultValue="0" className="bg-white/5 h-12 pl-10" />
                        </div>
                        <p className="text-[9px] text-muted-foreground italic">This amount is divided among the selected units.</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-primary">Total Payment Received Now (₦)</Label>
                        <div className="relative">
                          <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/60" />
                          <Input 
                            name="declaringPaid" 
                            type="number" 
                            defaultValue="0" 
                            className="bg-white/10 border-primary/20 h-14 text-xl font-bold pl-12 text-white" 
                          />
                        </div>
                        <p className="text-[9px] text-muted-foreground italic">Distributed across all {bookings.length} associated room records.</p>
                      </div>

                      <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Mark Stay Modification As:</Label>
                        <RadioGroup name="paymentStatus" defaultValue="unpaid" className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="paid" id="r-paid" className="border-emerald-500 text-emerald-500" />
                            <Label htmlFor="r-paid" className="text-xs font-bold text-emerald-500 cursor-pointer uppercase">Fully Settled</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="unpaid" id="r-unpaid" className="border-destructive text-destructive" />
                            <Label htmlFor="r-unpaid" className="text-xs font-bold text-destructive cursor-pointer uppercase">Unpaid / Deferred</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/[0.02] border-t border-white/5 pt-6">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || selectedIds.size === 0} 
                      className="w-full h-16 bg-primary text-primary-foreground font-bold text-lg rounded-2xl shadow-xl uppercase tracking-widest"
                    >
                      {isSubmitting ? "Finalizing Update..." : <><Save className="w-6 h-6 mr-2" /> Save Modification</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <BedDouble className="w-4 h-4" /> Guest Units Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/5">
                    {bookings.map((b) => {
                      const isSelected = selectedIds.has(b.id);
                      return (
                        <div key={b.id} className={cn(
                          "p-4 flex items-center justify-between transition-all",
                          isSelected ? "bg-white/[0.03]" : "opacity-40"
                        )}>
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              id={`select-${b.id}`} 
                              checked={isSelected} 
                              onCheckedChange={() => toggleSelection(b.id)}
                              className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                            />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white uppercase">{b.apartmentName}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Room {b.roomNumber}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             {!isSelected && (
                               <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleCheckout(b.id)}
                                title="Check out now (Drop Unit)"
                               >
                                 <LogOut className="w-4 h-4" />
                               </Button>
                             )}
                             {isSelected && <Badge variant="outline" className="border-primary/20 text-primary text-[8px] uppercase">Extending</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter className="p-4 bg-white/[0.02] border-t border-white/5">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Uncheck rooms the guest no longer wants to occupy. You can check them out immediately using the logout icon.
                      </p>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest pt-2">
                        Selected: {selectedIds.size} / {bookings.length}
                      </p>
                    </div>
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
