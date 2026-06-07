
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  ShoppingCart,
  LayoutGrid,
  History,
  Clock,
  User,
  X
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
  where, 
  orderBy 
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";

const categories = ["All", "Cocktails", "Beer", "Wine", "Food", "Spirits"];
const TABLES = Array.from({ length: 20 }, (_, i) => `Table ${i + 1}`);

export default function SalesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"quick" | "tables">("quick");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [cart, setCart] = useState<{ menuItemId: string; name: string; price: number; quantity: number }[]>([]);
  const [search, setSearch] = useState("");

  // Fetch Menu
  const menuQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "menu"), where("status", "==", "Active"));
  }, [firestore]);
  const { data: menuItems, loading: menuLoading } = useCollection(menuItemsQueryStab(menuQuery));

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

  function menuItemsQueryStab(q: any) { return q; }

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id);
      let newCart;
      if (existing) {
        newCart = prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        newCart = [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
      }

      // If we are in table mode, save to table session automatically
      if (selectedTable && firestore) {
        saveToTable(newCart);
      }
      
      return newCart;
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setCart(prev => {
      const newCart = prev.map(i => {
        if (i.menuItemId === menuItemId) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      });
      if (selectedTable && firestore) saveToTable(newCart);
      return newCart;
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => {
      const newCart = prev.filter(i => i.menuItemId !== menuItemId);
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

  const handleCheckout = (method: string) => {
    if (!firestore) return;

    const saleData = {
      items: cart,
      total,
      method,
      tableNumber: selectedTable || "Counter",
      timestamp: serverTimestamp()
    };

    addDoc(collection(firestore, "sales"), saleData)
      .then(() => {
        toast({
          title: "Sale Recorded",
          description: `Successfully processed ${method} payment of $${total.toFixed(2)}`,
        });
        
        // Clear table session if active
        if (selectedTable) {
          deleteDoc(doc(firestore, "tableSessions", selectedTable));
          setSelectedTable(null);
        }
        
        setCart([]);
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: "sales",
          operation: "create",
          requestResourceData: saleData,
        });
        errorEmitter.emit("permission-error", permissionError);
      });
  };

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    return menuItems.filter(item => 
      item.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [menuItems, search]);

  // Active table listener (for badges)
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
        {/* Header Toggle */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Bar Operations</h1>
            <p className="text-muted-foreground">Manage quick sales and table service efficiently.</p>
          </div>
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full md:w-auto">
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="quick" className="gap-2 px-6">
                <ShoppingCart className="w-4 h-4" /> Quick Sale
              </TabsTrigger>
              <TabsTrigger value="tables" className="gap-2 px-6">
                <LayoutGrid className="w-4 h-4" /> Table Service
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Work Area */}
          <div className="flex-1 space-y-6">
            {activeTab === "tables" && !selectedTable ? (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-xl font-headline flex items-center gap-2">
                    <LayoutGrid className="text-primary w-5 h-5" /> Select Table
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
                            active ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "hover:bg-white/5"
                          )}
                          onClick={() => {
                            setSelectedTable(table);
                            setActiveTab("quick"); // Switch to menu selection for this table
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
                      <span className="font-headline font-bold text-lg">Serving {selectedTable}</span>
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
                    placeholder="Search drinks and snacks..." 
                    className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl focus:border-primary/50" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <Tabs defaultValue="All" className="w-full">
                  <TabsList className="bg-transparent gap-2 flex-wrap h-auto">
                    {categories.map(cat => (
                      <TabsTrigger 
                        key={cat} 
                        value={cat} 
                        className="rounded-full px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-white/5"
                      >
                        {cat}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="mt-6">
                    {menuLoading ? (
                      <div className="py-20 text-center text-muted-foreground animate-pulse">Gathering menu data...</div>
                    ) : (
                      categories.map(cat => (
                        <TabsContent key={cat} value={cat}>
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredItems
                              .filter(item => (cat === "All" || item.category === cat))
                              .map(item => (
                                <Card 
                                  key={item.id} 
                                  className="glass-card hover:border-primary/40 transition-all cursor-pointer group overflow-hidden"
                                  onClick={() => addToCart(item)}
                                >
                                  <div className="h-1.5 w-full bg-primary/0 group-hover:bg-primary/40 transition-all" />
                                  <CardContent className="p-5 flex flex-col gap-2">
                                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{item.category}</span>
                                    <span className="font-headline font-bold text-lg leading-tight">{item.name}</span>
                                    <div className="flex justify-between items-center mt-2">
                                      <span className="text-primary font-headline font-bold text-xl">${item.price.toFixed(2)}</span>
                                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                        <Plus className="w-4 h-4" />
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </TabsContent>
                      ))
                    )}
                  </div>
                </Tabs>
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="w-full lg:w-[400px]">
            <Card className="glass-card flex flex-col h-[calc(100vh-280px)] sticky top-28">
              <CardHeader className="p-6 border-b border-white/5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-headline font-bold text-xl">
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
                    <div key={item.menuItemId} className="flex flex-col gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-start gap-4">
                        <span className="font-headline font-bold text-base leading-tight">{item.name}</span>
                        <button onClick={() => removeFromCart(item.menuItemId)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1">
                          <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg" onClick={() => updateQuantity(item.menuItemId, -1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-10 text-center font-headline font-bold">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg" onClick={() => updateQuantity(item.menuItemId, 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <span className="font-headline font-bold text-primary text-lg">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-8 bg-black/40 border-t border-white/5 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-muted-foreground font-medium">
                    <span>Subtotal</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-2xl font-bold">
                    <span className="font-headline">Total</span>
                    <span className="text-primary font-headline">${total.toFixed(2)}</span>
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
