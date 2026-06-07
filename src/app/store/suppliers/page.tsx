
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Truck, 
  Plus, 
  History, 
  PackagePlus, 
  User, 
  Phone, 
  MapPin,
  Trash2,
  ChevronDown,
  ArrowRight
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
  increment,
  deleteDoc
} from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function SuppliersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isReceiveStockOpen, setIsReceiveStockOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Receiving Stock
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [receiveItems, setReceiveItems] = useState<{ itemId: string; name: string; quantity: number }[]>([]);

  // Fetch Data
  const suppliersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "suppliers"), orderBy("name"));
  }, [firestore]);
  const { data: suppliers } = useCollection(suppliersQuery);

  const warehouseQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "warehouseInventory"), orderBy("name"));
  }, [firestore]);
  const { data: warehouseItems } = useCollection(warehouseQuery);

  const receivalsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "stockReceivals"), orderBy("receivedDate", "desc"));
  }, [firestore]);
  const { data: receivalHistory } = useCollection(receivalsQuery);

  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      contact: formData.get("contact") as string,
      address: formData.get("address") as string,
    };

    try {
      await addDoc(collection(firestore, "suppliers"), data);
      setIsAddSupplierOpen(false);
      toast({ title: "Supplier Added", description: `${data.name} is now in the vendor list.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add supplier." });
    }
  };

  const handleReceiveStock = async () => {
    if (!firestore || !user || !selectedSupplier || receiveItems.length === 0) return;
    setIsSubmitting(true);

    const supplier = suppliers?.find(s => s.id === selectedSupplier);
    const receivalData = {
      supplierId: selectedSupplier,
      supplierName: supplier?.name || "Unknown",
      receivedDate: serverTimestamp(),
      receivedBy: user.displayName || user.email,
      items: receiveItems
    };

    try {
      // 1. Log the receival
      await addDoc(collection(firestore, "stockReceivals"), receivalData);

      // 2. Update warehouse stock
      for (const item of receiveItems) {
        const itemRef = doc(firestore, "warehouseInventory", item.itemId);
        await updateDoc(itemRef, {
          stock: increment(item.quantity),
          lastUpdated: serverTimestamp()
        });
      }

      setIsReceiveStockOpen(false);
      setReceiveItems([]);
      setSelectedSupplier("");
      toast({ title: "Stock Received", description: "Warehouse stock has been successfully updated." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to process stock intake." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addItemToBatch = (item: any) => {
    if (receiveItems.find(i => i.itemId === item.id)) return;
    setReceiveItems(prev => [...prev, { itemId: item.id, name: item.name, quantity: 1 }]);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">Suppliers & Intake</h1>
            <p className="text-muted-foreground">Manage vendors and receive new stock into the warehouse.</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 border-white/10 rounded-xl px-6">
                  <Plus className="w-4 h-4 mr-2" /> Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-white/10">
                <DialogHeader>
                  <DialogTitle>Register New Vendor</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSupplier} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Vendor Name</Label>
                    <Input name="name" required placeholder="e.g. Nigerian Breweries PLC" className="bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Details</Label>
                    <Input name="contact" placeholder="Phone or Email" className="bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input name="address" placeholder="Office Location" className="bg-white/5" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full">Save Supplier</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isReceiveStockOpen} onOpenChange={setIsReceiveStockOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 bg-primary text-primary-foreground font-bold rounded-xl px-6 shadow-lg">
                  <PackagePlus className="w-4 h-4 mr-2" /> Receive New Stock
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-white/10 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" /> Stock Intake Batch
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label>Select Supplier</Label>
                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Choose Vendor" />
                      </SelectTrigger>
                      <SelectContent className="glass-card">
                        {suppliers?.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Add Warehouse Items to Batch</Label>
                    <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                      {warehouseItems?.map(item => (
                        <Button 
                          key={item.id} 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => addItemToBatch(item)}
                          className="h-8 border border-white/5 bg-white/5 text-[10px] uppercase font-bold"
                        >
                          + {item.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <Label className="uppercase text-[10px] tracking-widest text-muted-foreground font-bold">Items to Receive</Label>
                    {receiveItems.length === 0 ? (
                      <p className="text-center py-8 text-xs text-muted-foreground italic">No items selected yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {receiveItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="font-bold text-sm">{item.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground">Quantity:</span>
                              <Input 
                                type="number" 
                                className="w-20 h-8 bg-black/20 text-right font-bold" 
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value));
                                  setReceiveItems(prev => prev.map((i, k) => k === idx ? { ...i, quantity: val } : i));
                                }}
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => setReceiveItems(prev => prev.filter((_, k) => k !== idx))}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={handleReceiveStock} 
                    disabled={isSubmitting || !selectedSupplier || receiveItems.length === 0}
                    className="w-full h-12"
                  >
                    {isSubmitting ? "Processing..." : "Confirm & Update Warehouse"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Supplier Directory */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-lg font-headline font-bold flex items-center gap-2 text-white">
              <Truck className="w-5 h-5 text-primary" /> Vendor Directory
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {suppliers?.length === 0 ? (
                <Card className="glass-card border-dashed border-white/10 flex flex-col items-center justify-center py-10 opacity-40 text-center px-4">
                  <Truck className="w-8 h-8 mb-4" />
                  <p className="text-sm font-bold">No suppliers registered.</p>
                </Card>
              ) : (
                suppliers?.map(s => (
                  <Card key={s.id} className="glass-card hover:border-primary/30 transition-all">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-headline text-white">{s.name}</CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => deleteDoc(doc(firestore, "suppliers", s.id))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Phone className="w-3 h-3" /> {s.contact || "No contact"}
                      </div>
                      <div className="flex items-start gap-2 text-xs text-muted-foreground font-medium">
                        <MapPin className="w-3 h-3 mt-0.5" /> {s.address || "No address"}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Intake History */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-headline font-bold flex items-center gap-2 text-white">
              <History className="w-5 h-5 text-secondary" /> Intake History
            </h2>
            <Card className="glass-card">
              <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                {receivalHistory?.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground italic font-bold">No intake records found.</div>
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
                              <span className="text-sm font-bold text-white">{rec.supplierName}</span>
                              <span className="text-xs text-primary/70">{rec.items?.length || 0} items received</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Received By</span>
                                <span className="text-xs font-medium text-white/80">{rec.receivedBy}</span>
                              </div>
                              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="bg-white/[0.02] border-t border-white/5 p-4 space-y-4">
                          <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-white/5 pb-1">
                              <span>Warehouse Item</span>
                              <span>Quantity Added</span>
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
