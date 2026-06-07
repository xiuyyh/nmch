
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Package, 
  User,
  AlertCircle
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";

export default function StoreRequestsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const requestsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "restockRequests"), orderBy("requestDate", "desc"));
  }, [firestore]);

  const { data: requests, loading } = useCollection(requestsQuery);

  const handleAction = async (requestId: string, action: "Approved" | "Rejected") => {
    if (!firestore || !user) return;
    setProcessingId(requestId);

    const request = requests?.find(r => r.id === requestId);
    if (!request) return;

    const requestRef = doc(firestore, "restockRequests", requestId);
    const updateData = {
      status: action,
      processedBy: user.displayName || user.email,
      processedAt: serverTimestamp()
    };

    updateDoc(requestRef, updateData)
      .then(() => {
        if (action === "Approved") {
          // Update Inventory levels automatically
          for (const item of request.items) {
            const stockRef = doc(firestore, "inventory", item.itemId);
            const stockUpdate = {
              stock: increment(item.requestedQuantity),
              lastUpdated: serverTimestamp()
            };
            updateDoc(stockRef, stockUpdate).catch(err => {
              errorEmitter.emit("permission-error", new FirestorePermissionError({
                path: stockRef.path,
                operation: "update",
                requestResourceData: stockUpdate
              }));
            });
          }
          toast({
            title: "Request Approved",
            description: `Inventory levels updated for ${request.items.length} items.`,
          });
        } else {
          toast({
            title: "Request Rejected",
            variant: "destructive",
            description: "Request has been marked as rejected.",
          });
        }
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: requestRef.path,
          operation: "update",
          requestResourceData: updateData
        }));
      })
      .finally(() => setProcessingId(null));
  };

  const pendingRequests = requests?.filter(r => r.status === "Pending") || [];
  const processedRequests = requests?.filter(r => r.status !== "Pending") || [];

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Stock Requests</h1>
            <p className="text-muted-foreground">Review and approve restock requirements from the Bar.</p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-2 rounded-2xl">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pending</span>
              <span className="text-xl font-headline font-bold text-amber-500">{pendingRequests.length}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Pending Requests */}
          <div className="space-y-6">
            <h2 className="text-lg font-headline font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" /> Pending Approval
            </h2>
            {loading ? (
              <div className="py-20 text-center animate-pulse text-muted-foreground">Checking live requests...</div>
            ) : pendingRequests.length === 0 ? (
              <Card className="glass-card border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center py-20 opacity-40">
                <CheckCircle2 className="w-10 h-10 mb-4" />
                <p className="italic">All clear! No pending requests.</p>
              </Card>
            ) : (
              pendingRequests.map(req => (
                <Card key={req.id} className="glass-card overflow-hidden border-l-4 border-l-amber-500">
                  <CardHeader className="pb-4 bg-white/[0.02]">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
                          Requested {req.requestDate?.toDate ? format(req.requestDate.toDate(), "PPP HH:mm") : "N/A"}
                        </span>
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <User className="w-4 h-4" /> {req.requestedBy}
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] border-white/10">#{req.id.slice(-6).toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Requested Items</p>
                      <div className="grid grid-cols-1 gap-2">
                        {req.items?.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="font-bold">{item.name}</span>
                            <Badge className="bg-primary/20 text-primary border-none">x{item.requestedQuantity}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="grid grid-cols-2 gap-3 pt-0">
                    <Button 
                      variant="outline" 
                      onClick={() => handleAction(req.id, "Rejected")}
                      disabled={!!processingId}
                      className="h-12 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                    <Button 
                      onClick={() => handleAction(req.id, "Approved")}
                      disabled={!!processingId}
                      className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Update Stock
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>

          {/* Processed History Section */}
          <div className="space-y-6">
            <h2 className="text-lg font-headline font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" /> Processed Log
            </h2>
            <Card className="glass-card">
              <CardContent className="p-0 max-h-[800px] overflow-y-auto">
                {processedRequests.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground italic">No processed history.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {processedRequests.map(req => (
                      <div key={req.id} className="p-4 space-y-3 hover:bg-white/[0.02] transition-colors">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-muted-foreground">
                              {req.processedAt?.toDate ? format(req.processedAt.toDate(), "MMM dd, HH:mm") : "N/A"}
                            </span>
                            <span className="text-sm font-bold">{req.items?.length || 0} items processed</span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "font-bold uppercase tracking-widest text-[10px]",
                              req.status === "Approved" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                            )}
                          >
                            {req.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-end text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                          <span>By: {req.requestedBy}</span>
                          <span>Auth: {req.processedBy}</span>
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
  );
}
