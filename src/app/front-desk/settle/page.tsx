
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
  Banknote, 
  ChevronLeft, 
  Save, 
  User, 
  BedDouble, 
  Info,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function SettleBalancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  
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
        
        // Auto-fill with current debt
        const totalCost = data.reduce((sum, b) => sum + (b.totalStayCost || 0), 0);
        const totalPaid = data.reduce((sum, b) => sum + (b.checkInAmountPaid || 0) + (b.retainingAmountPaid || 0), 0);
        setPaymentAmount(Math.max(0, totalCost - totalPaid));
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
  const currentDebt = totalGroupCost - totalGroupPaid;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || bookings.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const perRoomPayment = paymentAmount / bookings.length;

      const promises = bookings.map(b => {
        const totalNewPaid = (b.checkInAmountPaid || 0) + (b.retainingAmountPaid || 0) + perRoomPayment;
        return updateDoc(doc(firestore, "roomBookings", b.id), {
          retainingAmountPaid: (b.retainingAmountPaid || 0) + perRoomPayment,
          isPaid: totalNewPaid >= (b.totalStayCost || 0),
          lastModified: serverTimestamp()
        });
      });

      await Promise.all(promises);
      toast({ title: "Payment Recorded", description: `₦${paymentAmount.toLocaleString()} has been added to guest records.` });
      router.push("/front-desk/room-manager");
    } catch (error) {
      toast({ variant: "destructive", title: "Payment Error", description: "Could not record payment details." });
    } finally {
      setIsSubmitting(false);
    }
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
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/5">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Balance Settlement</h1>
              <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">
                Guest: {guestInfo.guestName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <Banknote className="text-emerald-500 w-5 h-5" /> Record Payment
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-8 pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Stay Cost</span>
                        <span className="text-xl font-headline font-bold text-white">₦{totalGroupCost.toLocaleString()}</span>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Already Paid</span>
                        <span className="text-xl font-headline font-bold text-emerald-500">₦{totalGroupPaid.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 p-6 bg-destructive/5 border border-destructive/10 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-destructive uppercase tracking-[0.2em]">Outstanding Debt</span>
                        <Badge variant="destructive" className="h-6 uppercase font-bold text-[10px]">Unsettled</Badge>
                      </div>
                      <span className="text-4xl font-headline font-bold text-destructive">
                        ₦{currentDebt.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-primary">Declare Payment Received (₦)</Label>
                        <div className="relative">
                          <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/60" />
                          <Input 
                            type="number" 
                            required
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(Number(e.target.value))}
                            className="bg-white/10 border-primary/20 h-16 text-3xl font-headline font-bold pl-14 text-white" 
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground italic px-1">
                          Enter the exact amount collected during this transaction.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/[0.02] border-t border-white/5 pt-6">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || paymentAmount <= 0} 
                      className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-2xl shadow-xl uppercase tracking-widest transition-all active:scale-[0.98]"
                    >
                      {isSubmitting ? "Processing..." : <><Save className="w-6 h-6 mr-2" /> Confirm & Post Payment</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <BedDouble className="w-4 h-4" /> Guest Units
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/5">
                    {bookings.map((b, idx) => (
                      <div key={idx} className="p-4 flex flex-col gap-2 hover:bg-white/[0.01] transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white uppercase">{b.apartmentName}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Room {b.roomNumber}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold">
                           <span className="text-muted-foreground uppercase">Portion:</span>
                           <span className="text-white">₦{b.totalStayCost?.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-4 bg-white/[0.02] border-t border-white/5">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Payments recorded here will be distributed across the guest's active room records to ensure total financial reconciliation.
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
