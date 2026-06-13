
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
  Plus
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

  // Fetch requestable materials configured by admin
  const materialsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "requestableMaterials"), where("source", "==", selectedSource), orderBy("name"));
  }, [firestore, selectedSource]);

  const { data: materials } = useCollection(materialsQuery);

  // Fetch recent requests by this user
  const historyQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "materialRequests"), 
      where("requestedBy", "==", user.displayName || user.email),
      orderBy("timestamp", "desc"),
      limit(10)
    );
  }, [firestore, user]);

  const { data: history } = useCollection(historyQuery);

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
      toast({ title: "Request Sent", description: `Materials requested from ${selectedSource}.` });
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
        <div className="max-w-6xl mx-auto space-y-10">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <RefreshCw className="w-8 h-8 text-primary" /> Request Materials
            </h1>
            <p className="text-muted-foreground mt-1">Procure supplies from the Laundry department or the Main Store.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => { setSelectedSource("Laundry"); setRequestItems([]); }}
                  className={cn(
                    "flex-1 h-16 rounded-2xl gap-3 text-sm font-bold uppercase tracking-widest transition-all",
                    selectedSource === "Laundry" ? "bg-primary text-primary-foreground border-primary shadow-xl" : "bg-white/5 border-white/5 hover:bg-white/10"
                  )}
                >
                  <WashingMachine className="w-6 h-6" /> Laundry
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => { setSelectedSource("Store"); setRequestItems([]); }}
                  className={cn(
                    "flex-1 h-16 rounded-2xl gap-3 text-sm font-bold uppercase tracking-widest transition-all",
                    selectedSource === "Store" ? "bg-primary text-primary-foreground border-primary shadow-xl" : "bg-white/5 border-white/5 hover:bg-white/10"
                  )}
                >
                  <Warehouse className="w-6 h-6" /> Main Store
                </Button>
              </div>

              <Card className="glass-card overflow-hidden">
                <CardHeader className="bg-white/5 border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" /> Select Items from {selectedSource}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {materials?.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-8">No materials configured for this source by Admin.</p>
                    ) : materials?.map(m => (
                      <Button 
                        key={m.id} 
                        variant="ghost" 
                        onClick={() => addToRequest(m.name)}
                        disabled={requestItems.some(i => i.name === m.name)}
                        className="h-10 px-4 bg-white/5 border border-white/5 rounded-xl text-xs font-bold hover:bg-primary/20 hover:text-white"
                      >
                        + {m.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
                {requestItems.length > 0 && (
                  <div className="border-t border-white/5">
                    <div className="divide-y divide-white/5">
                      {requestItems.map((item, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between">
                          <span className="font-bold text-sm text-white">{item.name}</span>
                          <div className="flex items-center gap-4">
                            <Input 
                              type="number" 
                              value={item.quantity} 
                              onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                              className="w-20 h-10 bg-black/20 text-center font-bold"
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 bg-white/[0.02]">
                      <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl">
                        {isSubmitting ? "Sending..." : <><Send className="w-5 h-5 mr-2" /> Submit Request to {selectedSource}</>}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card flex flex-col h-full">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Request Log
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/5">
                    {history?.length === 0 ? (
                      <div className="py-20 text-center text-muted-foreground opacity-30 italic px-6">No recent requests.</div>
                    ) : history?.map(req => (
                      <div key={req.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className={cn(
                            "text-[8px] uppercase px-1.5 h-4",
                            req.status === 'Pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}>
                            {req.status}
                          </Badge>
                          <span className="text-[9px] font-bold text-muted-foreground/60">
                             {req.timestamp?.toDate ? format(req.timestamp.toDate(), "HH:mm, dd MMM") : "..."}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-white/90">From: <span className="font-bold text-primary">{req.source}</span></p>
                          <div className="flex flex-wrap gap-1">
                             {req.items?.map((i: any, k: number) => (
                               <Badge key={k} variant="outline" className="bg-white/5 border-none text-[8px]">{i.name} x{i.quantity}</Badge>
                             ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
