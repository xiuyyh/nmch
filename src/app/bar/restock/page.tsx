"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Package,
  AlertTriangle,
  ChevronDown,
  ArrowRight,
  Search
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function BarRestockPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [requestItems, setRequestItems] = useState<{ itemId: string; name: string; quantity: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");

  // Fetch Inventory for selection
  const inventoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventory"), orderBy("name"));
  }, [firestore]);
  const { data: inventory } = useCollection(inventoryQuery);

  // Fetch Request History
  const historyQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "restockRequests"), orderBy("requestDate", "desc"));
  }, [firestore]);
  const { data: history, loading: historyLoading } = useCollection(historyQuery);

  const lowStockItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => item.stock <= item.min);
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => 
      item.name?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.category?.toLowerCase().includes(inventorySearch.toLowerCase())
    );
  }, [inventory, inventorySearch]);

  const addToRequest = (item: any) => {
    if (requestItems.find(i => i.itemId === item.id)) return;
    setRequestItems(prev => [...prev, { itemId: item.id, name: item.name, quantity: 1 }]);
  };

  const updateQuantity = (itemId: string, qty: number) => {
    setRequestItems(prev => prev.map(i => i.itemId === itemId ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const removeItem = (itemId: string) => {
    setRequestItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  const handleSubmit = async () => {
    if (!firestore || !user || requestItems.length === 0) return;
    setIsSubmitting(true);

    const requestData = {
      requestDate: serverTimestamp(),
      items: requestItems.map(i => ({
        itemId: i.itemId,
        name: i.name,
        requestedQuantity: i.quantity
      })),
      status: "Pending",
      requestedBy: user.displayName || user.email
    };

    addDoc(collection(firestore, "restockRequests"), requestData)
      .then(() => {
        toast({
          title: "Request Submitted",
          description: "Your restock request has been sent to the store manager.",
        });
        setRequestItems([]);
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "restockRequests",
          operation: "create",
          requestResourceData: requestData
        }));
      })
      .finally(() => setIsSubmitting(false));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
      case "Approved": return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
      case "Rejected": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
      default: return null;
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Bar Restock Hub</h1>
          <p className="text-muted-foreground">Request beverages and supplies from the main store.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Request Section */}
          <div className="lg:col-span-2 space-y-6">
            {lowStockItems.length > 0 && (
              <Card className="glass-card border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-500 uppercase tracking-widest">
                    <AlertTriangle className="w-4 h-4" /> Critical Low Stock
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {lowStockItems.map(item => (
                    <Button 
                      key={item.id} 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addToRequest(item)}
                      className="h-8 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/20 text-xs font-bold"
                    >
                      + {item.name} ({item.stock})
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <Plus className="text-primary w-5 h-5" /> New Request
                </CardTitle>
                {requestItems.length > 0 && (
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary text-primary-foreground font-bold shadow-lg h-9">
                    <Send className="w-4 h-4 mr-2" /> {isSubmitting ? "Sending..." : "Submit Request"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {requestItems.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center text-muted-foreground opacity-40">
                    <Package className="w-10 h-10 mb-4" />
                    <p className="italic">Your request list is empty. Add items from inventory below.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {requestItems.map(item => (
                      <div key={item.itemId} className="p-4 flex items-center justify-between hover:bg-white/5">
                        <span className="font-bold text-lg">{item.name}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center bg-white/5 rounded-xl border border-white/5 p-1">
                            <span className="text-xs font-bold text-muted-foreground px-3">QTY:</span>
                            <Input 
                              type="number" 
                              className="w-20 h-8 bg-transparent border-none text-right font-bold focus-visible:ring-0" 
                              value={item.quantity} 
                              onChange={(e) => updateQuantity(item.itemId, Number(e.target.value))}
                            />
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.itemId)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardHeader className="border-t border-white/5 bg-white/[0.02] space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground shrink-0">Select from Inventory</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search items..." 
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="pl-9 h-8 bg-white/5 border-white/10 text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 max-h-[300px] overflow-y-auto pr-2">
                  {filteredInventory.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4">No matching items found.</p>
                  ) : (
                    filteredInventory.map(item => (
                      <Button 
                        key={item.id} 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => addToRequest(item)}
                        className="h-8 bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest hover:border-primary/50"
                      >
                        {item.name}
                      </Button>
                    ))
                  )}
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* History Section */}
          <div className="space-y-6">
            <Card className="glass-card">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <ClipboardList className="text-primary w-5 h-5" /> Request Log
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                {historyLoading ? (
                  <div className="py-20 text-center animate-pulse text-muted-foreground">Loading log...</div>
                ) : history?.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground italic">No past requests.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {history?.map(req => (
                      <Collapsible key={req.id} className="group">
                        <CollapsibleTrigger asChild>
                          <div className="p-4 space-y-3 hover:bg-white/5 transition-colors cursor-pointer">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                  {req.requestDate?.toDate ? format(req.requestDate.toDate(), "MMM dd, HH:mm") : "N/A"}
                                </span>
                                <span className="text-sm font-bold">{req.items?.length || 0} items requested</span>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                {getStatusBadge(req.status)}
                                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="bg-white/[0.02] border-t border-white/5 p-4 space-y-4">
                          <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-white/5 pb-1">
                              <span>Item</span>
                              <span>Status</span>
                            </div>
                            {req.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span className={cn("text-white/80", item.isDeclined && "line-through text-muted-foreground")}>
                                  {item.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-muted-foreground">
                                    {item.requestedQuantity}
                                  </span>
                                  {req.status === "Approved" && !item.isDeclined && (
                                    <>
                                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                      <Badge variant="outline" className="h-5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1 text-[10px]">
                                        {item.approvedQuantity} Received
                                      </Badge>
                                    </>
                                  )}
                                  {item.isDeclined && (
                                    <Badge variant="destructive" className="h-5 text-[8px] uppercase px-1">Declined</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="pt-2 flex flex-col gap-1 border-t border-white/5">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground/60">
                              <span>Requested by: {req.requestedBy}</span>
                              {req.processedBy && <span>Authorized: {req.processedBy}</span>}
                            </div>
                            {req.processedAt && (
                              <span className="text-[10px] uppercase font-bold text-muted-foreground/60 text-right">
                                Processed: {format(req.processedAt.toDate(), "MMM dd, HH:mm")}
                              </span>
                            )}
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
