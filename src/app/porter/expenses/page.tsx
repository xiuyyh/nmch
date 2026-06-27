
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
  Banknote
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { sendTelegramNotification } from "@/lib/notifications";

export default function PorterExpenseLogPage() {
  const firestore = useFirestore();
  const { user } = userUser();
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
    const details = formData.get("details") as string;
    const staffName = user.displayName || user.email;

    const expenseData = {
      type: "Electricity",
      amount,
      details: details || "Electricity Recharge (Light Bill)",
      staffName,
      staffId: user.uid,
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "expenses"), expenseData);
      
      // Telegram Notification
      const telegramMsg = `⚡ *ELECTRICITY RECHARGE*\n\n*Amount:* ₦${amount.toLocaleString()}\n*Details:* ${expenseData.details}\n*Staff:* ${staffName}`;
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
        <div className="max-w-5xl mx-auto space-y-10">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <Zap className="w-8 h-8 text-primary" /> Electricity Recharge
            </h1>
            <p className="text-muted-foreground mt-1">Log electricity token purchases and light bill payments here.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-primary" /> Log Payment
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-5">
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
                      <Label htmlFor="details" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Token/Receipt Details (Optional)</Label>
                      <Textarea 
                        id="details" 
                        name="details" 
                        placeholder="e.g. 50 units for main building..." 
                        className="bg-white/5 min-h-[100px]"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-xl"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Submit Entry</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2">
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
                        <div key={log.id} className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary">
                               <Zap className="w-4 h-4" />
                             </div>
                             <div className="flex flex-col">
                               <span className="text-lg font-bold text-white">₦{log.amount?.toLocaleString()}</span>
                               <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate max-w-[200px]">
                                 {log.details}
                               </p>
                             </div>
                          </div>
                          <div className="text-right">
                             <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase">
                               <Clock className="w-3 h-3" /> {log.timestamp?.toDate ? format(log.timestamp.toDate(), "dd MMM, HH:mm") : "..."}
                             </span>
                             <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] mt-1">LOGGED</Badge>
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

function userUser() {
  const { user, loading } = useUser();
  return { user, loading };
}
