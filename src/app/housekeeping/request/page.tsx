
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  RefreshCw, 
  Send, 
  History, 
  User, 
  Clock, 
  CheckCircle2,
  Trash2,
  Package,
  WashingMachine,
  Warehouse,
  Plus,
  Loader2
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, limit, where } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function MaterialRequestPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [requestItems, setRequestItems] = useState<{ name: string; quantity: number }[]>([]);
  const [selectedSource, setSelectedSource] = useState<"Laundry" | "Store">("Laundry");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const materialsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "requestableMaterials"), where("source", "==", selectedSource), orderBy("name"));
  }, [firestore, selectedSource]);

  const { data: materials, loading: materialsLoading } = useCollection(materialsQuery);

  const historyQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "materialRequests"), 
      where("requestedBy", "==", user.displayName || user.email),
      orderBy("timestamp", "desc"),
      limit(10)
    );
  }, [firestore, user]);

  const { data: history, loading: historyLoading } = useCollection(historyQuery);

  const addToRequest = (name: string) => {
    if (requestItems.find(i => i.name === name)) return;
    setRequestItems([...requestItems, { name, quantity: 1 }]);
  };

  const removeItem = (idx: number) => {
    setRequestItems(requestItems.filter((_, i) => i !== idx));
  };

  const updateQuantity = (idx: number, val: number) => {
    setRequestItems(requestItems.map((item, i) => 
      i === idx ? { ...item, quantity: Math.max(1, val) } : item
    ));
  };

  const handleSubmit = async () => {
    if (!firestore || !user || requestItems.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    const requestData = {
      requestedBy: user.displayName || user.email,
      source: selectedSource,
      items: requestItems,
      status: "Pending",
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "materialRequests"), requestData);
      toast({ title: "Request Sent", description: "Successfully routed to " + selectedSource });
      setRequestItems([]);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to send request." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["housekeeper", "admin"]}>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> Material Request
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Source supplies from Laundry or the Main Store.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => { setSelectedSource("Laundry"); setRequestItems([]); }}
                  className={cn(
                    "h-14 sm:h-20 rounded-2xl gap-2 sm:gap-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all",
                    selectedSource === "Laundry" ? "bg-primary text-primary-foreground border-primary shadow-lg" : "bg-white/5 border-white/5"
                  )}
                >
                  <WashingMachine className="w-5 h-5 sm:w-6 sm:h-6" /> Laundry
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => { setSelectedSource("Store"); setRequestItems([]); }}
                  className={cn(
                    "h-14 sm:h-20 rounded-2xl gap-2 sm:gap-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all",
                    selectedSource === "Store" ? "bg-primary text-primary-foreground border-primary shadow-lg" : "bg-white/5 border-white/5"
                  )}
                >
                  <Warehouse className="w-5 h-5 sm:w-6 sm:h-6" /> Store
                </Button>
              </div>

              <Card className="glass-card overflow-hidden">
                <CardHeader className="bg-white/5 border-b border-white/5 p-4">
                  <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <Plus className="w-4 h-4 text-primary" /> Available from {selectedSource}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {materialsLoading ? (
                    <div className="py-8 text-center animate-pulse text-xs uppercase font-bold text-muted-foreground">Loading...</div>
                  ) : materials?.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-8 text-center">No items available for this source.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {materials?.map(m => (
                        <Button 
                          key={m.id} 
                          variant="ghost" 
                          onClick={() => addToRequest(m.name)}
                          disabled={requestItems.some(i => i.name === m.name)}
                          className="h-9 px-3 sm:px-4 bg-white/5 border border-white/5 rounded-xl text-[10px] sm:text-xs font-bold hover:bg-primary/20"
                        >
                          + {m.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
                
                {requestItems.length > 0 && (
                  <div className="border-t border-white/5">
                    <div className="divide-y divide-white/5">
                      {requestItems.map((item, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between">
                          <span className="font-bold text-xs sm:text-sm text-white truncate mr-2">{item.name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center bg-black/20 rounded-lg border border-white/10 px-2">
                               <span className="text-[8px] font-bold text-muted-foreground mr-2">QTY:</span>
                               <Input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                                className="w-14 h-8 bg-transparent border-none text-center font-bold text-xs focus-visible:ring-0"
                              />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive h-8 w-8">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 sm:p-6 bg-white/[0.02]">
                      <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-14 sm:h-16 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl text-sm sm:text-base">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send className="w-5 h-5 mr-2" /> Send Request</>}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card flex flex-col h-full min-h-[300px]">
                <CardHeader className="border-b border-white/5 p-4">
                  <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <History className="w-4 h-4 text-primary" /> Personal Request Log
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto max-h-[600px]">
                  {historyLoading ? (
                    <div className="py-10 text-center animate-pulse text-xs">Syncing...</div>
                  ) : history?.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground opacity-30 italic px-6 text-sm">No recent history.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {history?.map(req => (
                        <div key={req.id} className="p-4 space-y-2 hover:bg-white/[0.01]">
                          <div className="flex justify-between items-start">
                            <Badge variant="outline" className={cn(
                              "text-[7px] uppercase px-1.5 h-4 border-none",
                              req.status === 'Pending' ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                            )}>
                              {req.status}
                            </Badge>
                            <span className="text-[8px] font-bold text-muted-foreground/60">
                               {req.timestamp?.toDate ? format(req.timestamp.toDate(), "HH:mm, dd MMM") : "..."}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-white/90">Source: <span className="font-bold text-primary">{req.source}</span></p>
                            <div className="flex flex-wrap gap-1">
                               {req.items?.map((i: any, k: number) => (
                                 <Badge key={k} variant="outline" className="bg-white/5 border-none text-[7px] h-4 px-1">{i.name} x{i.quantity}</Badge>
                               ))}
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
