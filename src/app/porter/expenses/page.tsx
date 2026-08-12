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
  Home,
  Trash2
} from "lucide-react";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, limit, doc, deleteDoc } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { sendTelegramNotification } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PorterExpenseLogPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userRecord } = useDoc(userRef);
  const isAdmin = userRecord?.role === 'admin';

  const historyQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "expenses"),
      where("type", "==", "Electricity"),
      limit(50)
    );
  }, [firestore]);

  const { data: rawLogs, loading, error: queryError } = useCollection(historyQuery);

  const logs = useMemo(() => {
    if (!rawLogs) return [];
    return [...rawLogs].sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return timeB - timeA;
    }).slice(0, 15);
  }, [rawLogs]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

    addDoc(collection(firestore, "expenses"), expenseData)
      .then(() => {
        toast({ title: "Expense Recorded", description: "Light bill recharge has been logged to the cloud." });
        (e.target as HTMLFormElement).reset();
        
        const telegramMsg = `⚡ *ELECTRICITY RECHARGE*\n\n*Target:* ${expenseData.apartmentName}\n*Amount:* ₦${amount.toLocaleString()}\n*Staff:* ${staffName}\n*Details:* ${expenseData.details}`;
        sendTelegramNotification(firestore, telegramMsg);
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: "expenses",
          operation: "create",
          requestResourceData: expenseData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleDelete = (id: string) => {
    if (!firestore || !isAdmin) return;
    deleteDoc(doc(firestore, "expenses", id)).then(() => {
      toast({ title: "Deleted", description: "Entry removed from ledger." });
    });
  };

  return (
    <RoleGuard allowedRoles={["porter", "admin"]}>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                Electricity Recharge
              </h1>
              <p className="text-muted-foreground mt-1">Log electricity token purchases and light bill payments here.</p>
            </div>
          </div>

          {queryError && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex flex-col gap-2 text-destructive animate-pulse">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-widest">Cloud Sync Warning</p>
              </div>
              <p className="text-[10px] opacity-80 leading-relaxed">
                The system is having trouble syncing with the cloud. This usually happens if the database requires a specialized index or permissions are restricted.
              </p>
            </div>
          )}

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
                    <History className="w-4 h-4 text-primary" /> Global Recharge Log
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-20 text-center animate-pulse text-muted-foreground uppercase font-bold text-xs tracking-widest">Accessing Logs...</div>
                  ) : logs.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground italic px-6">No recharges logged in this period.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {logs.map((log) => (
                        <div key={log.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors group">
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
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                             <div className="flex items-center gap-2 text-muted-foreground">
                               <Clock className="w-3 h-3" />
                               <span className="text-[9px] font-bold uppercase tracking-widest">
                                 {log.timestamp?.toDate ? format(log.timestamp.toDate(), "dd MMM, HH:mm") : "..."}
                               </span>
                             </div>
                             <div className="flex items-center gap-3">
                               <div className="flex items-center gap-1 text-[8px] font-bold text-primary/60 uppercase">
                                 <User className="w-2.5 h-2.5" /> {log.staffName}
                               </div>
                               {isAdmin && (
                                 <AlertDialog>
                                   <AlertDialogTrigger asChild>
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                       <Trash2 className="w-3.5 h-3.5" />
                                     </Button>
                                   </AlertDialogTrigger>
                                   <AlertDialogContent className="glass-card border-white/10">
                                     <AlertDialogHeader>
                                       <AlertDialogTitle>Delete Recharge Entry?</AlertDialogTitle>
                                       <AlertDialogDescription>
                                         This action is permanent and will remove the ₦{log.amount?.toLocaleString()} record for {log.apartmentName} from the global ledger.
                                       </AlertDialogDescription>
                                     </AlertDialogHeader>
                                     <AlertDialogFooter>
                                       <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                                       <AlertDialogAction onClick={() => handleDelete(log.id)} className="bg-destructive text-white font-bold">Delete Permanently</AlertDialogAction>
                                     </AlertDialogFooter>
                                   </AlertDialogContent>
                                 </AlertDialog>
                               )}
                             </div>
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
