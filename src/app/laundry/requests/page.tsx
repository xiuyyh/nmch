
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
  ArrowRight
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

  // Fetch material requests routed to Laundry
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
      toast({ title: "Request Fulfilled", description: "The material handover has been recorded." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update status." });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = requests?.filter(r => r.status === "Pending").length || 0;

  return (
    <RoleGuard allowedRoles={["laundry", "admin"]}>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <ListTodo className="w-8 h-8 text-primary" /> Incoming Housekeeping Requests
              </h1>
              <p className="text-muted-foreground mt-1">Review and fulfill material requirements from the cleaning staff.</p>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-6 py-2 text-sm font-bold">
               {pendingCount} PENDING
            </Badge>
          </div>

          {loading ? (
            <div className="py-32 text-center animate-pulse text-muted-foreground font-headline font-bold uppercase tracking-widest">Syncing Request Queue...</div>
          ) : requests?.length === 0 ? (
            <div className="py-40 text-center opacity-30 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-16 h-16" />
              <p className="font-bold uppercase tracking-widest text-sm">All requests fulfilled</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {requests?.map((req) => {
                const isPending = req.status === "Pending";
                return (
                  <Card key={req.id} className={cn(
                    "glass-card overflow-hidden border-l-4 transition-all duration-300",
                    isPending ? "border-l-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.05)]" : "border-l-emerald-500 opacity-60 grayscale-[0.5]"
                  )}>
                    <CardHeader className="bg-white/[0.02] border-b border-white/5 pb-4">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-2 text-primary font-bold">
                             <Brush className="w-4 h-4" /> {req.requestedBy}
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                             <Clock className="w-3 h-3" /> {req.timestamp?.toDate ? format(req.timestamp.toDate(), "HH:mm, dd MMM") : "..." }
                           </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-bold uppercase",
                          isPending ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                        )}>
                          {req.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-6 space-y-4">
                       <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Required Items:</p>
                          <div className="grid grid-cols-1 gap-2">
                            {req.items?.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                                <span className="font-bold text-white text-sm">{item.name}</span>
                                <span className="text-xl font-headline font-bold text-primary">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                       </div>
                    </CardContent>
                    {isPending && (
                      <CardFooter className="pt-0 pb-6">
                        <Button 
                          onClick={() => handleCompleteRequest(req.id)}
                          disabled={processingId === req.id}
                          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xl uppercase tracking-widest text-xs"
                        >
                          {processingId === req.id ? "Processing..." : <><CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Fulfilled</>}
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
