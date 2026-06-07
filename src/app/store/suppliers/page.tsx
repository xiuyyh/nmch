
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  History, 
  PackagePlus, 
  Trash2,
  ChevronDown,
  ArrowRight,
  Search,
  CheckCircle2,
  Box
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment
} from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function NewSupplyPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiveItems, setReceiveItems] = useState<{ itemId: string; name: string; quantity: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Warehouse Inventory
  const warehouseQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "warehouseInventory"), orderBy("name"));
  }, [firestore]);
  const { data: warehouseItems } = useCollection(warehouseQuery);

  // Fetch Intake History
  const receivalsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "stockReceivals"), orderBy("receivedDate", "desc"));
  }, [firestore]);
  const { data: receivalHistory, loading: historyLoading } = useCollection(receivalsQuery);

  const filteredItems = useMemo(() => {
    if (!warehouseItems) return [];
    return warehouseItems.filter(item => 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [warehouseItems, searchQuery]);

  const handleReceiveStock = async () => {
    if (!firestore || !user || receiveItems.length === 0) return;
    setIsSubmitting(true);

    const receivalData = {
      supplierName: "Direct Supply", // Generic as vendor directory is removed
      receivedDate: serverTimestamp(),
      receivedBy: user.displayName || user.email,
      items: receiveItems
    };

    try {
      // 1. Log the receival
      const receivalRef = collection(firestore, "stockReceivals");
      await addDoc(receivalRef, receivalData);

      // 2. Update warehouse stock
      for (const item of receiveItems) {
        const itemRef = doc(firestore, "warehouseInventory", item.itemId);
        await updateDoc(itemRef, {
          stock: increment(item.quantity),
          lastUpdated: serverTimestamp()
        }).catch(err => {
          errorEmitter.emit("permission-error", new FirestorePermissionError({
            path: itemRef.path,
            operation: "update",
            requestResourceData: { stock: increment(item.quantity) }
          }));
        });
      }

      setReceiveItems([]);
      toast({ 
        title: "Warehouse Updated", 
        description: `Successfully added ${receiveItems.length} items to warehouse stock.` 
      });
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "Failed to process stock intake." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addItemToBatch = (item: any) => {
    if (receiveItems.find(i => i.itemId === item.id)) return;
    setReceiveItems(prev => [...prev, { itemId: item.id, name: item.name, quantity: 1 }]);
  };

  const updateBatchQuantity = (idx: number, val: number) => {
    setReceiveItems(prev => prev.map((item, k) => 
      k === idx ? { ...item, quantity: Math.max(1, val) } : item
    ));
  };

  const removeItemFromBatch = (idx: number) => {
    setReceiveItems(prev => prev.filter((_, k) => k !== idx));
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">New Supply Intake</h1>
            <p className="text-muted-foreground">Log items received today to update the main warehouse inventory.</p>
          </div>
          {receiveItems.length > 0 && (
            <Button 
              onClick={handleReceiveStock} 
              disabled={isSubmitting}
              className="h-12 bg-primary text-primary-foreground font-bold rounded-xl px-8 shadow-xl animate-in fade-in slide-in-from-right-4"
            >
              {isSubmitting ? (
                "Processing..."
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" /> Confirm & Add {receiveItems.length} Items
                </>
              )}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Batch & Selector */}
          <div className="space-y-6">
            <Card className="glass-card overflow-hidden">
              <CardHeader className="bg-white/5 border-b border-white/5">
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-primary" /> Current Batch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {receiveItems.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center opacity-40">
                    <Box className="w-12 h-12 mb-4" />
                    <p className="italic font-bold">Select items below to start intake</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {receiveItems.map((item, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{item.name}</span>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Intake Quantity</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input 
                            type="number" 
                            className="w-24 h-10 bg-black/20 text-right font-bold border-white/10" 
                            value={item.quantity}
                            onChange={(e) => updateBatchQuantity(idx, Number(e.target.value))}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItemFromBatch(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Warehouse Selection</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search items to add..." 
                      className="pl-10 bg-white/5 border-white/10 h-10 text-xs"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                  {filteredItems.map(item => (
                    <Button 
                      key={item.id} 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addItemToBatch(item)}
                      className={cn(
                        "h-9 px-4 border-white/5 bg-white/5 text-[10px] uppercase font-bold rounded-xl hover:bg-primary/20 hover:border-primary/30 transition-all",
                        receiveItems.some(i => i.itemId === item.id) && "bg-primary/20 border-primary/40 text-primary pointer-events-none"
                      )}
                    >
                      + {item.name}
                    </Button>
                  ))}
                  {filteredItems.length === 0 && (
                    <p className="w-full text-center py-8 text-xs text-muted-foreground italic">No warehouse items found.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Intake History */}
          <div className="space-y-6">
            <h2 className="text-lg font-headline font-bold flex items-center gap-2 text-white">
              <History className="w-5 h-5 text-primary" /> Today's Supply Log
            </h2>
            <Card className="glass-card">
              <CardContent className="p-0 max-h-[750px] overflow-y-auto">
                {historyLoading ? (
                  <div className="py-20 text-center animate-pulse text-muted-foreground">Gathering logs...</div>
                ) : receivalHistory?.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground italic font-bold">No intake records for this period.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {receivalHistory?.map(rec => (
                      <Collapsible key={rec.id} className="group">
                        <CollapsibleTrigger asChild>
                          <div className="p-4 flex justify-between items-center hover:bg-white/[0.02] cursor-pointer">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                                {rec.receivedDate?.toDate ? format(rec.receivedDate.toDate(), "PPP HH:mm") : "N/A"}
                              </span>
                              <span className="text-sm font-bold text-white">{rec.items?.length || 0} Items Processed</span>
                              <span className="text-xs text-primary/70">Received by {rec.receivedBy}</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="bg-white/[0.02] border-t border-white/5 p-4 space-y-4">
                          <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-white/5 pb-1">
                              <span>Warehouse Item</span>
                              <span>Added</span>
                            </div>
                            {rec.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-white/80">{item.name}</span>
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5 font-bold">
                                    +{item.quantity}
                                  </Badge>
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
