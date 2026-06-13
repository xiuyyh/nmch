
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  WashingMachine, 
  Save, 
  History, 
  Clock, 
  Activity,
  CheckCircle2
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, limit } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function LaundryOperationsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "laundryLogs"), orderBy("timestamp", "desc"), limit(20));
  }, [firestore]);

  const { data: logs, loading } = useCollection(logsQuery);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const itemsCount = Number(formData.get("itemsWashed"));

    const logData = {
      staffName: user.displayName || user.email,
      itemsWashed: itemsCount,
      date: format(new Date(), "yyyy-MM-dd"),
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "laundryLogs"), logData);
      toast({ title: "Laundry Logged", description: `Recorded ${itemsCount} items washed successfully.` });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save log entry." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["laundry", "admin"]}>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-10">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" /> Laundry Operations
            </h1>
            <p className="text-muted-foreground mt-1">Log daily washing output and performance.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <WashingMachine className="w-5 h-5 text-primary" /> Wash Output
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="itemsWashed" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Items Washed Today</Label>
                      <Input 
                        id="itemsWashed" 
                        name="itemsWashed" 
                        type="number" 
                        min="1" 
                        required 
                        className="bg-white/5 h-12 text-xl font-bold" 
                        placeholder="0"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="w-full h-12 bg-primary text-primary-foreground font-bold"
                    >
                      {isSubmitting ? "Processing..." : <><Save className="w-4 h-4 mr-2" /> Log Activity</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="glass-card flex flex-col h-full">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Output History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-20 text-center animate-pulse text-muted-foreground font-bold uppercase text-xs tracking-widest">Gathering Data...</div>
                  ) : logs?.length === 0 ? (
                    <div className="py-20 text-center opacity-40 italic">No wash records yet.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {logs?.map((log) => (
                        <div key={log.id} className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                               {log.itemsWashed}
                             </div>
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-white uppercase">{log.staffName}</span>
                               <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase">
                                 <Clock className="w-3 h-3" /> {log.timestamp?.toDate ? format(log.timestamp.toDate(), "dd MMM | HH:mm") : "..."}
                               </span>
                             </div>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500/40" />
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
