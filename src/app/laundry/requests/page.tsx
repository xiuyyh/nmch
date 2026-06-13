
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ListTodo, 
  CheckCircle2, 
  Clock, 
  User, 
  Brush,
  ChevronDown,
  ArrowRight,
  Loader2
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function LaundryRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const requestsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "materialRequests"), 
      where("source", "==", "Laundry"),
      orderBy("timestamp", "desc")
    );
  }, [firestore]);

  const { data: requests, loading } = useCollection(requestsQuery);

  const handleCompleteRequest = async (requestId: string) => {
    if (!firestore) return;
    setProcessingId(requestId);

    const requestRef = doc(firestore, "materialRequests", requestId);
    try {
      await updateDoc(requestRef, { status: "Completed", completedAt: serverTimestamp() });
      toast({ title: "Fulfilled", description: "Request marked as complete." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Status update failed." });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = requests?.filter(r => r.status === "Pending").length || 0;

  return (
    <RoleGuard allowedRoles={["laundry", "admin"]}>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-8 sm:space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <ListTodo className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> Incoming Requests
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Review and fulfill material needs from cleaning staff.</p>
            </div>
            <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 px-4 sm:px-6 py-2 rounded-2xl w-full sm:w-auto justify-between sm:justify-start">
               <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Active Queue</span>
               <span className="text-lg font-headline font-bold text-white">{pendingCount} PENDING</span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center animate-pulse text-muted-foreground font-bold uppercase tracking-widest text-xs">Syncing queue...</div>
          ) : requests?.length === 0 ? (
            <div className="py-32 text-center opacity-30 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16" />
              <p className="font-bold uppercase tracking-widest text-xs sm:text-sm">Queue is empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {requests?.map((req) => {
                const isPending = req.status === "Pending";
                return (
                  <Card key={req.id} className={cn(
                    "glass-card overflow-hidden border-l-4 transition-all duration-300",
                    isPending ? "border-l-amber-500 shadow-lg" : "border-l-emerald-500 opacity-60"
                  )}>
                    <CardHeader className="bg-white/[0.02] border-b border-white/5 p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0 flex flex-col gap-0.5">
                           <div className="flex items-center gap-2 text-primary font-bold text-xs sm:text-sm truncate">
                             <Brush className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{req.requestedBy}</span>
                           </div>
                           <div className="flex items-center gap-2 text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase">
                             <Clock className="w-3 h-3 shrink-0" /> {req.timestamp?.toDate ? format(req.timestamp.toDate(), "HH:mm, dd MMM") : "..." }
                           </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[7px] sm:text-[8px] font-bold uppercase px-1.5 h-4 shrink-0",
                          isPending ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                        )}>
                          {req.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-4 sm:py-6 space-y-4 p-4 sm:p-6">
                       <div className="space-y-2">
                          <p className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Requirements:</p>
                          <div className="grid grid-cols-1 gap-2">
                            {req.items?.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between items-center p-2 sm:p-3 bg-white/5 rounded-xl border border-white/5">
                                <span className="font-bold text-white text-xs sm:text-sm truncate mr-2">{item.name}</span>
                                <span className="text-lg sm:text-xl font-headline font-bold text-primary shrink-0">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                       </div>
                    </CardContent>
                    {isPending && (
                      <CardFooter className="pt-0 pb-6 px-4 sm:px-6">
                        <Button 
                          onClick={() => handleCompleteRequest(req.id)}
                          disabled={processingId === req.id}
                          className="w-full h-12 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xl uppercase tracking-widest text-[10px] sm:text-xs"
                        >
                          {processingId === req.id ? <Loader2 className="animate-spin" /> : "Verify Fulfillment"}
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </RoleGuard>
  );
}
