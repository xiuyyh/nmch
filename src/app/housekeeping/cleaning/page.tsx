
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Sparkles, 
  Save, 
  History, 
  User, 
  Clock, 
  CheckCircle2,
  Brush
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, limit } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function CleaningOperationsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "housekeepingLogs"), orderBy("timestamp", "desc"), limit(20));
  }, [firestore]);

  const { data: logs, loading } = useCollection(logsQuery);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const roomsCount = Number(formData.get("roomsCleaned"));

    const logData = {
      staffName: user.displayName || user.email,
      roomsCleaned: roomsCount,
      date: format(new Date(), "yyyy-MM-dd"),
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "housekeepingLogs"), logData);
      toast({ title: "Operations Logged", description: `Recorded ${roomsCount} rooms cleaned for today.` });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save log entry." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["housekeeper", "admin"]}>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-10">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" /> Cleaning Operations
            </h1>
            <p className="text-muted-foreground mt-1">Report daily cleaning output for performance tracking.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brush className="w-5 h-5 text-primary" /> New Daily Log
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="roomsCleaned" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Rooms Cleaned Today</Label>
                      <Input 
                        id="roomsCleaned" 
                        name="roomsCleaned" 
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
                      {isSubmitting ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Submit Log</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="glass-card flex flex-col h-full">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Performance History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-20 text-center animate-pulse text-muted-foreground uppercase font-bold text-xs tracking-widest">Loading History...</div>
                  ) : logs?.length === 0 ? (
                    <div className="py-20 text-center opacity-40 italic">No entries recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {logs?.map((log) => (
                        <div key={log.id} className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                               {log.roomsCleaned}
                             </div>
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-white uppercase">{log.staffName}</span>
                               <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase">
                                 <Clock className="w-3 h-3" /> {log.timestamp?.toDate ? format(log.timestamp.toDate(), "dd MMM | HH:mm") : "..."}
                               </span>
                             </div>
                          </div>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px]">VERIFIED</Badge>
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
