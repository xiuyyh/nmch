"use client";

import React, { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User,
  ChevronDown,
  ArrowRight
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, increment, serverTimestamp, getDocs, where } from "firebase/firestore";
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
  
  const [adjustments, setAdjustments] = useState<Record<string, any>>({});

  const requestsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "restockRequests"), orderBy("requestDate", "desc"));
  }, [firestore]);

  const { data: requests, loading } = useCollection(requestsQuery);

  useEffect(() => {
    if (requests) {
      const initialAdjustments: Record<string, any> = { ...adjustments };
      requests.forEach(req => {
        if (req.status === "Pending" && !initialAdjustments[req.id]) {
          initialAdjustments[req.id] = req.items.map((item: any) => ({
            ...item,
            approvedQuantity: item.requestedQuantity,
            isDeclined: false
          }));
        }
      });
      setAdjustments(initialAdjustments);
    }
  }, [requests]);

  const updateItemAdjustment = (reqId: string, itemIdx: number, field: string, value: any) => {
    setAdjustments(prev => ({
      ...prev,
      [reqId]: prev[reqId].map((item: any, idx: number) => 
        idx === itemIdx ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleAction = (requestId: string, action: "Approved" | "Rejected") => {
    if (!firestore || !user) return;
    setProcessingId(requestId);

    const request = requests?.find(r => r.id === requestId);
    if (!request) return;

    const requestAdjustments = adjustments[requestId];
    const requestRef = doc(firestore, "restockRequests", requestId);
    
    const updateData = {
      status: action,
      processedBy: user.displayName || user.email,
      processedAt: serverTimestamp(),
      items: action === "Approved" ? requestAdjustments : request.items
    };

    updateDoc(requestRef, updateData)
      .then(() => {
        if (action === "Approved") {
          const syncPromises = requestAdjustments.map((item: any) => {
            if (!item.isDeclined && item.approvedQuantity > 0) {
              const barStockRef = doc(firestore, "inventory", item.itemId);
              const barUpdate = updateDoc(barStockRef, {
                stock: increment(item.approvedQuantity),
                lastUpdated: serverTimestamp()
              });

              const warehouseRef = collection(firestore, "warehouseInventory");
              const warehouseQuery = query(warehouseRef, where("name", "==", item.name));
              const warehouseUpdate = getDocs(warehouseQuery).then(warehouseSnap => {
                if (!warehouseSnap.empty) {
                  const wDoc = warehouseSnap.docs[0];
                  const wRef = doc(firestore, "warehouseInventory", wDoc.id);
                  return updateDoc(wRef, {
                    stock: increment(-item.approvedQuantity),
                    lastUpdated: serverTimestamp()
                  });
                }
              });

              return Promise.all([barUpdate, warehouseUpdate]);
            }
            return Promise.resolve();
          });

          Promise.all(syncPromises).then(() => {
            toast({
              title: "Request Processed",
              description: `Inventory synced and warehouse stock deducted.`,
            });
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
      .finally(() => {
        setProcessingId(null);
      });
  };

  const pendingRequests = requests?.filter(r => r.status === "Pending") || [];
  const processedRequests = requests?.filter(r => r.status !== "Pending") || [];

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">Stock Requests</h1>
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
          <div className="space-y-6">
            <h2 className="text-lg font-headline font-bold flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-amber-500" /> Pending Approval
            </h2>
            {loading ? (
              <div className="py-20 text-center animate-pulse text-muted-foreground font-headline font-bold uppercase tracking-widest">Checking requests...</div>
            ) : pendingRequests.length === 0 ? (
              <Card className="glass-card border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center py-20 opacity-40">
                <CheckCircle2 className="w-10 h-10 mb-4" />
                <p className="italic font-bold">All clear!</p>
              </Card>
            ) : (
              pendingRequests.map(req => {
                const reqAdjustments = adjustments[req.id] || [];
                return (
                  <Card key={req.id} className="glass-card overflow-hidden border-l-4 border-l-amber-500">
                    <CardHeader className="pb-4 bg-white/[0.02] border-b border-white/5">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                            Requested {req.requestDate?.toDate ? format(req.requestDate.toDate(), "PPP HH:mm") : "N/A"}
                          </span>
                          <div className="flex items-center gap-2 text-primary font-bold">
                            <User className="w-4 h-4" /> {req.requestedBy}
                          </div>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] border-white/10 text-white">#{req.id.slice(-6).toUpperCase()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-4 space-y-4">
                      <div className="space-y-3">
                        {reqAdjustments.map((item: any, i: number) => (
                          <div key={i} className={cn(
                            "p-3 rounded-xl border transition-all duration-300",
                            item.isDeclined 
                              ? "bg-destructive/5 border-destructive/20 opacity-60" 
                              : "bg-white/5 border-white/5"
                          )}>
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex flex-col">
                                <span className={cn("font-bold text-sm", item.isDeclined && "line-through text-muted-foreground")}>{item.name}</span>
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">REQ: {item.requestedQuantity}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`decline-${req.id}-${i}`} className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">Decline</Label>
                                <Switch 
                                  id={`decline-${req.id}-${i}`}
                                  checked={item.isDeclined} 
                                  onCheckedChange={(val) => updateItemAdjustment(req.id, i, "isDeclined", val)}
                                  className="data-[state=checked]:bg-destructive"
                                />
                              </div>
                            </div>
                            
                            {!item.isDeclined && (
                              <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5">
                                <Label className="text-[10px] font-bold text-primary uppercase tracking-widest px-1">Give:</Label>
                                <Input 
                                  type="number" 
                                  min="0"
                                  className="h-8 bg-transparent border-none text-right font-bold focus-visible:ring-0 text-white" 
                                  value={item.approvedQuantity} 
                                  onChange={(e) => updateItemAdjustment(req.id, i, "approvedQuantity", Number(e.target.value))}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="grid grid-cols-2 gap-3 pt-0 pb-6">
                      <Button 
                        variant="outline" 
                        onClick={() => handleAction(req.id, "Rejected")}
                        disabled={!!processingId}
                        className="h-12 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 font-bold uppercase tracking-widest text-xs"
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Reject
                      </Button>
                      <Button 
                        onClick={() => handleAction(req.id, "Approved")}
                        disabled={!!processingId}
                        className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(5,150,105,0.2)]"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-headline font-bold flex items-center gap-2 text-white">
              <ClipboardList className="w-5 h-5 text-primary" /> Processed Log
            </h2>
            <Card className="glass-card">
              <CardContent className="p-0 max-h-[800px] overflow-y-auto">
                {processedRequests.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground italic font-bold">No history.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {processedRequests.map(req => (
                      <Collapsible key={req.id} className="group">
                        <CollapsibleTrigger asChild>
                          <div className="p-4 space-y-3 hover:bg-white/[0.02] transition-colors cursor-pointer">
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                  {req.processedAt?.toDate ? format(req.processedAt.toDate(), "MMM dd, HH:mm") : "N/A"}
                                </span>
                                <span className="text-sm font-bold text-white">{req.items?.length || 0} items processed</span>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "font-bold uppercase tracking-widest text-[10px] px-2 py-0.5",
                                    req.status === "Approved" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                                  )}
                                >
                                  {req.status}
                                </Badge>
                                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="bg-white/[0.02] border-t border-white/5 p-4 space-y-4">
                          <div className="space-y-3">
                            {req.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <div className="flex flex-col">
                                  <span className={cn("text-white/80", item.isDeclined && "line-through text-muted-foreground")}>
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">REQ: {item.requestedQuantity}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {req.status === "Approved" ? (
                                    item.isDeclined ? (
                                      <Badge variant="destructive" className="h-5 text-[8px] uppercase px-1">Declined</Badge>
                                    ) : (
                                      <Badge variant="outline" className="h-5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1 text-[10px]">
                                        {item.approvedQuantity} Given
                                      </Badge>
                                    )
                                  ) : (
                                    <Badge variant="outline" className="h-5 border-white/10 text-muted-foreground px-1 text-[10px]">Canceled</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
