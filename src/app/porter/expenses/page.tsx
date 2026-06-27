
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Zap, 
  Save, 
  History, 
  Clock, 
  User, 
  AlertCircle,
  Loader2,
  Banknote,
  Home
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { sendTelegramNotification } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";

export default function PorterExpenseLogPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const historyQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "expenses"),
      where("staffId", "==", user.uid),
      where("type", "==", "Electricity"),
      orderBy("timestamp", "desc"),
      limit(10)
    );
  }, [firestore, user]);

  const { data: logs, loading } = useCollection(historyQuery);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get("amount"));
    const apartmentName = formData.get("apartmentName") as string;
    const details = formData.get("details") as string;
    const staffName = user.displayName || user.email;

    const expenseData = {
      type: "Electricity",
      amount,
      apartmentName: apartmentName || "General",
      details: details || `Electricity Recharge for ${apartmentName || 'Hotel'}`,
      staffName,
      staffId: user.uid,
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "expenses"), expenseData);
      
      // Telegram Notification
      const telegramMsg = `⚡ *ELECTRICITY RECHARGE*\n\n*Target:* ${expenseData.apartmentName}\n*Amount:* ₦${amount.toLocaleString()}\n*Staff:* ${staffName}\n*Details:* ${expenseData.details}`;
      sendTelegramNotification(firestore, telegramMsg);

      toast({ title: "Expense Recorded", description: "Light bill recharge has been logged." });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to log expense." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["porter", "admin"]}>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Zap className="w-8 h-8 text-primary" /> Electricity Recharge
              </h1>
              <p className="text-muted-foreground mt-1">Log electricity token purchases and light bill payments here.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
            <div className="lg:col-span-1">
              <Card className="glass-card">
                <CardHeader className="bg-white/5 border-b border-white/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-primary" /> Log Payment
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-5 pt-6">
                    <div className="space-y-2">
                      <Label htmlFor="apartmentName" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Target Apartment / Unit</Label>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          id="apartmentName" 
                          name="apartmentName" 
                          required 
                          placeholder="e.g. Flat 1, Reception, Gate" 
                          className="bg-white/5 h-12 pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Recharge Amount (₦)</Label>
                      <Input 
                        id="amount" 
                        name="amount" 
                        type="number" 
                        required 
                        className="bg-white/5 h-12 text-xl font-bold" 
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="details" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Additional Details (Optional)</Label>
                      <Textarea 
                        id="details" 
                        name="details" 
                        placeholder="e.g. 50 units, Receipt #..." 
                        className="bg-white/5 min-h-[100px] text-xs"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 pb-8">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="w-full h-14 bg-primary text-primary-foreground font-bold shadow-xl rounded-xl uppercase tracking-widest"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Submit Recharge</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card className="glass-card flex flex-col h-full">
                <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <History className="w-4 h-4" /> Personal Log History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-20 text-center animate-pulse text-muted-foreground uppercase font-bold text-xs tracking-widest">Accessing Logs...</div>
                  ) : logs?.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground italic px-6">No recharges logged by you yet.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {logs?.map((log) => (
                        <div key={log.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors">
                          <div className="flex items-start gap-4">
                             <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                               <Zap className="w-5 h-5" />
                             </div>
                             <div className="flex flex-col min-w-0">
                               <div className="flex items-center gap-2">
                                 <span className="text-lg font-bold text-white font-headline">₦{log.amount?.toLocaleString()}</span>
                                 <Badge variant="outline" className="text-[8px] uppercase h-5 bg-white/5 border-white/10">{log.apartmentName}</Badge>
                               </div>
                               <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate max-w-[200px] sm:max-w-none mt-1">
                                 {log.details}
                               </p>
                             </div>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                             <div className="flex items-center gap-2 text-muted-foreground">
                               <Clock className="w-3 h-3" />
                               <span className="text-[9px] font-bold uppercase tracking-widest">
                                 {log.timestamp?.toDate ? format(log.timestamp.toDate(), "dd MMM, HH:mm") : "..."}
                               </span>
                             </div>
                             <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px]">VERIFIED</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
