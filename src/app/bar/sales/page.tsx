
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  ShoppingCart,
  LayoutGrid,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useDoc, useFirestore } from "@/firebase";
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy,
  increment,
  updateDoc
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ITEMS_PER_PAGE = 8;
const TABLES = Array.from({ length: 20 }, (_, i) => `Table ${i + 1}`);

export default function SalesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"quick" | "tables">("quick");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [cart, setCart] = useState<{ itemId: string; name: string; price: number; quantity: number }[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch Inventory items directly for selling
  const inventoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventory"), orderBy("name"));
  }, [firestore]);
  const { data: inventoryItems, loading: inventoryLoading } = useCollection(inventoryQuery);

  // Fetch Active Table Order if any
  const tableRef = useMemo(() => {
    if (!firestore || !selectedTable) return null;
    return doc(firestore, "tableSessions", selectedTable);
  }, [firestore, selectedTable]);
  const { data: tableSession } = useDoc(tableRef);

  // Sync cart with table session when table changes
  React.useEffect(() => {
    if (selectedTable && tableSession) {
      setCart(tableSession.items || []);
    } else if (selectedTable && !tableSession) {
      setCart([]);
    }
  }, [selectedTable, tableSession]);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.itemId === item.id);
      let newCart;
      if (existing) {
        newCart = prev.map(i => i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        newCart = [...prev, { itemId: item.id, name: item.name, price: item.price || 0, quantity: 1 }];
      }

      if (selectedTable && firestore) {
        saveToTable(newCart);
      }
      
      return newCart;
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      const newCart = prev.map(i => {
        if (i.itemId === itemId) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      });
      if (selectedTable && firestore) saveToTable(newCart);
      return newCart;
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const newCart = prev.filter(i => i.itemId !== itemId);
      if (selectedTable && firestore) saveToTable(newCart);
      return newCart;
    });
  };

  const saveToTable = (items: any[]) => {
    if (!firestore || !selectedTable) return;
    const ref = doc(firestore, "tableSessions", selectedTable);
    setDoc(ref, {
      tableNumber: selectedTable,
      items,
      lastUpdated: serverTimestamp()
    }, { merge: true }).catch(err => {
      console.error("Error saving table session", err);
    });
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async (method: string) => {
    if (!firestore) return;

    const saleData = {
      items: cart,
      total,
      method,
      tableNumber: selectedTable || "Counter",
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "sales"), saleData);

      // Decrement inventory stock directly for each item sold
      for (const cartItem of cart) {
        const stockRef = doc(firestore, "inventory", cartItem.itemId);
        updateDoc(stockRef, {
          stock: increment(-cartItem.quantity),
          lastUpdated: serverTimestamp()
        });
      }

      toast({
        title: "Sale Recorded",
        description: `Processed ₦${total.toLocaleString()} via ${method}. Stock updated.`,
      });
      
      if (selectedTable) {
        deleteDoc(doc(firestore, "tableSessions", selectedTable));
        setSelectedTable(null);
      }
      
      setCart([]);
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: "sales",
        operation: "create",
        requestResourceData: saleData,
      });
      errorEmitter.emit("permission-error", permissionError);
    }
  };

  const filteredItems = useMemo(() => {
    if (!inventoryItems) return [];
    return inventoryItems.filter(item => 
      item.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [inventoryItems, search]);

  // Pagination Logic
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const activeTablesQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, "tableSessions");
  }, [firestore]);
  const { data: allActiveSessions } = useCollection(activeTablesQuery);

  const isTableActive = (table: string) => {
    return allActiveSessions?.some(s => s.tableNumber === table);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6 h-full max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Bar Sales</h1>
          </div>
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full md:w-auto">
            <TabsList className="bg-white/5 border border-white/10 p-1">
              <TabsTrigger value="quick" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <ShoppingCart className="w-4 h-4" /> Quick Sale
              </TabsTrigger>
              <TabsTrigger value="tables" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <LayoutGrid className="w-4 h-4" /> Table Service
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-6">
            {activeTab === "tables" && !selectedTable ? (
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-xl font-headline flex items-center gap-2">
                    <LayoutGrid className="text-primary w-5 h-5" /> Select Table to Begin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {TABLES.map(table => {
                      const active = isTableActive(table);
                      return (
                        <Button
                          key={table}
                          variant="outline"
                          className={cn(
                            "h-24 flex flex-col gap-2 rounded-2xl border-white/5 transition-all",
                            active ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "hover:bg-white/5 hover:border-white/10"
                          )}
                          onClick={() => {
                            setSelectedTable(table);
                            setActiveTab("quick");
                          }}
                        >
                          <span className="font-headline font-bold text-lg">{table.split(' ')[1]}</span>
                          {active && (
                            <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold">
                              <Clock className="w-3 h-3" /> Active Tab
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {selectedTable && (
                  <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary rounded-lg text-primary-foreground">
                        <LayoutGrid className="w-5 h-5" />
                      </div>
                      <span className="font-headline font-bold text-lg text-white">Serving {selectedTable}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedTable(null);
                        setCart([]);
                      }}
                      className="text-primary hover:bg-primary/20"
                    >
                      <X className="w-4 h-4 mr-2" /> Release Table
                    </Button>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search inventory items..." 
                    className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl focus:border-primary/50" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="mt-6 space-y-6">
                  {inventoryLoading ? (
                    <div className="py-20 text-center text-muted-foreground animate-pulse">Gathering inventory...</div>
                  ) : filteredItems.length === 0 ? (
                    <Card className="glass-card border-dashed border-white/10 bg-transparent">
                      <CardContent className="py-20 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-headline font-bold mb-2">No items found</h3>
                        <p className="text-muted-foreground max-w-sm mb-8">
                          {search 
                            ? `We couldn't find any items matching "${search}".`
                            : "Your inventory is currently empty. Add items in the Bar Inventory section to start selling."
                          }
                        </p>
                        {!search && (
                          <Button asChild className="gap-2">
                            <Link href="/inventory">
                              Go to Bar Inventory <ArrowRight className="w-4 h-4" />
                            </Link>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {paginatedItems.map(item => (
                          <Card 
                            key={item.id} 
                            className="glass-card hover:border-primary/40 transition-all cursor-pointer group overflow-hidden"
                            onClick={() => addToCart(item)}
                          >
                            <div className="h-1.5 w-full bg-primary/0 group-hover:bg-primary/40 transition-all" />
                            <CardContent className="p-5 flex flex-col gap-2">
                              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{item.category}</span>
                              <span className="font-headline font-bold text-lg leading-tight text-white">{item.name}</span>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-primary font-headline font-bold text-xl">₦{(item.price || 0).toLocaleString()}</span>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                  <Plus className="w-4 h-4" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                          <p className="text-xs text-muted-foreground">
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length} items
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="h-10 px-4 rounded-xl"
                            >
                              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                            </Button>
                            <div className="flex items-center gap-1 text-sm font-bold px-4 bg-primary/10 rounded-xl text-primary">
                              {currentPage} / {totalPages}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                              className="h-10 px-4 rounded-xl"
                            >
                              Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-full lg:w-[400px]">
            <Card className="glass-card flex flex-col h-[calc(100vh-280px)] sticky top-28 border-white/5">
              <CardHeader className="p-6 border-b border-white/5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-headline font-bold text-xl text-white">
                    {selectedTable ? `Bill: ${selectedTable}` : "Quick Sale"}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">
                    {cart.length} items selected
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => {
                  setCart([]);
                  if(selectedTable) saveToTable([]);
                }} disabled={cart.length === 0} className="hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="w-5 h-5" />
                </Button>
              </CardHeader>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 text-center p-8">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                      <ShoppingCart className="w-8 h-8" />
                    </div>
                    <p className="font-medium italic">Your cart is empty.<br/>Select items to begin order.</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.itemId} className="flex flex-col gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-start gap-4">
                        <span className="font-headline font-bold text-base leading-tight text-white">{item.name}</span>
                        <button onClick={() => removeFromCart(item.itemId)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1">
                          <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg" onClick={() => updateQuantity(item.itemId, -1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-10 text-center font-headline font-bold text-white">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg" onClick={() => updateQuantity(item.itemId, 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <span className="font-headline font-bold text-primary text-lg">₦{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-8 bg-black/40 border-t border-white/5 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-muted-foreground font-medium">
                    <span>Subtotal</span>
                    <span>₦{total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-2xl font-bold">
                    <span className="font-headline text-white">Total</span>
                    <span className="text-primary font-headline">₦{total.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    size="lg"
                    className="bg-primary text-primary-foreground neon-glow-primary hover:opacity-90 font-bold h-14 rounded-2xl shadow-xl"
                    disabled={cart.length === 0}
                    onClick={() => handleCheckout('Card')}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    Card
                  </Button>
                  <Button 
                    size="lg"
                    className="bg-secondary text-secondary-foreground neon-glow-secondary hover:opacity-90 font-bold h-14 rounded-2xl shadow-xl"
                    disabled={cart.length === 0}
                    onClick={() => handleCheckout('Cash')}
                  >
                    <Banknote className="w-5 h-5 mr-2" />
                    Cash
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
