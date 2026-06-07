
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  ArrowLeftRight,
  Printer,
  CookingPot,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useDoc, useFirestore, useUser } from "@/firebase";
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

const ITEMS_PER_PAGE = 5;
const TABLES = Array.from({ length: 20 }, (_, i) => `Table ${i + 1}`);

interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  isSent?: boolean;
}

export default function SalesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"quick" | "tables" | "history">("quick");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [shouldPrintDucket, setShouldPrintDucket] = useState(true);

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
  useEffect(() => {
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
        newCart = prev.map(i => i.itemId === item.id ? { ...i, quantity: i.quantity + 1, isSent: false } : i);
      } else {
        newCart = [...prev, { 
          itemId: item.id, 
          name: item.name, 
          price: item.price || 0, 
          quantity: 1,
          category: item.category,
          isSent: false
        }];
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
          return { ...i, quantity: newQty, isSent: false }; // Reset isSent if quantity changes
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

  const sendItemToKitchen = (itemId: string) => {
    if (!firestore) return;
    const item = cart.find(i => i.itemId === itemId);
    if (!item || item.category !== "FOOD") return;

    const kitchenOrderData = {
      tableNumber: selectedTable || "Counter",
      items: [{ name: item.name, quantity: item.quantity }],
      timestamp: serverTimestamp(),
      staffName: user?.displayName || user?.email || "Bar Staff"
    };

    addDoc(collection(firestore, "kitchenOrders"), kitchenOrderData)
      .then(() => {
        toast({
          title: "Order Sent to Kitchen",
          description: `${item.name} x${item.quantity} sent.`,
        });
        
        // Update local state and firestore session
        setCart(prev => {
          const newCart = prev.map(i => i.itemId === itemId ? { ...i, isSent: true } : i);
          if (selectedTable) saveToTable(newCart);
          return newCart;
        });
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "kitchenOrders",
          operation: "create",
          requestResourceData: kitchenOrderData
        }));
      });
  };

  const saveToTable = async (items: any[]) => {
    if (!firestore || !selectedTable) return;
    const ref = doc(firestore, "tableSessions", selectedTable);
    
    if (items.length === 0) {
      deleteDoc(ref).catch(err => {
        // Silently fail
      });
    } else {
      setDoc(ref, {
        tableNumber: selectedTable,
        items,
        lastUpdated: serverTimestamp()
      }, { merge: true }).catch(err => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: ref.path,
          operation: "write",
          requestResourceData: { tableNumber: selectedTable, items }
        }));
      });
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async (method: string) => {
    if (!firestore || cart.length === 0) return;

    const saleData = {
      items: cart,
      total,
      method,
      tableNumber: selectedTable || "Counter",
      timestamp: serverTimestamp(),
      status: "Completed"
    };

    // Optimistic record creation
    addDoc(collection(firestore, "sales"), saleData)
      .then((docRef) => {
        if (shouldPrintDucket) {
          printDucket({ ...saleData, id: docRef.id });
        }
      })
      .catch(async (error: any) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "sales",
          operation: "create",
          requestResourceData: saleData,
        }));
      });

    // Handle remaining unsent FOOD items (in case they haven't fired them yet)
    const unsentFoodItems = cart.filter(item => item.category === "FOOD" && !item.isSent);
    if (unsentFoodItems.length > 0) {
      const kitchenOrderData = {
        tableNumber: selectedTable || "Counter",
        items: unsentFoodItems.map(i => ({ name: i.name, quantity: i.quantity })),
        timestamp: serverTimestamp(),
        staffName: user?.displayName || user?.email || "Bar Staff"
      };

      addDoc(collection(firestore, "kitchenOrders"), kitchenOrderData).catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "kitchenOrders",
          operation: "create",
          requestResourceData: kitchenOrderData
        }));
      });
    }

    // Decrement inventory stock (excluding FOOD)
    for (const cartItem of cart) {
      if (cartItem.category === "FOOD") continue; // Food has no inventory tracking
      
      const stockRef = doc(firestore, "inventory", cartItem.itemId);
      const stockUpdate = {
        stock: increment(-cartItem.quantity),
        lastUpdated: serverTimestamp()
      };
      
      updateDoc(stockRef, stockUpdate).catch(async (error) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: stockRef.path,
          operation: "update",
          requestResourceData: stockUpdate
        }));
      });
    }

    toast({
      title: "Sale Recorded",
      description: `Processed ₦${total.toLocaleString()} via ${method}.`,
    });
    
    if (selectedTable) {
      deleteDoc(doc(firestore, "tableSessions", selectedTable));
      setSelectedTable(null);
    }
    
    setCart([]);
    setIsMobileCartOpen(false);
  };

  const printDucket = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = sale.items.map((item: any) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 800; font-size: 16px;">
        <span>${item.name} x ${item.quantity}</span>
        <span>₦${(item.price * item.quantity).toLocaleString()}</span>
      </div>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Ducket #${sale.id.slice(-6)}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              font-family: 'Arial', sans-serif; 
              width: 80mm; 
              padding: 10mm; 
              font-size: 14px; 
              color: #000;
              line-height: 1.4;
            }
            .center { text-align: center; }
            .bold { font-weight: 900; }
            .divider { border-bottom: 2px solid #000; margin: 10px 0; }
            .header { font-size: 24px; font-weight: 900; margin-bottom: 6px; text-transform: uppercase; }
            .subheader { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
            .total { font-size: 22px; font-weight: 900; margin-top: 12px; border-top: 2px solid #000; padding-top: 8px; }
            .meta { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
          </style>
        </head>
        <body>
          <div class="center header">NIGHTINGALE HOTEL</div>
          <div class="center subheader">Sales Ducket</div>
          <div class="divider"></div>
          <div class="meta">DATE: ${new Date().toLocaleString()}</div>
          <div class="meta">REC#: ${sale.id.slice(-8).toUpperCase()}</div>
          <div class="meta">SERV: ${sale.tableNumber}</div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="total" style="display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>₦${sale.total.toLocaleString()}</span>
          </div>
          <div class="meta" style="margin-top: 8px; font-size: 16px;">PAYMENT: ${sale.method}</div>
          <div class="divider"></div>
          <div class="center bold" style="margin-top: 15px; font-size: 16px;">*** THANK YOU ***</div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const filteredItems = useMemo(() => {
    if (!inventoryItems) return [];
    return inventoryItems.filter(item => 
      item.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [inventoryItems, search]);

  useEffect(() => {
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
    return allActiveSessions?.some(s => s.tableNumber === table && (s.items?.length || 0) > 0);
  };

  const CartUI = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 text-center p-4">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium italic">Cart is empty</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.itemId} className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/60">{item.category}</span>
                  <span className="font-headline font-bold text-sm leading-tight text-white line-clamp-2">{item.name}</span>
                </div>
                <button onClick={() => removeFromCart(item.itemId)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1 bg-black/20 rounded-lg p-0.5">
                  <Button size="icon" variant="ghost" className="w-6 h-6 rounded-md" onClick={() => updateQuantity(item.itemId, -1)}>
                    <Minus className="w-2.5 h-2.5" />
                  </Button>
                  <span className="w-6 text-center text-xs font-headline font-bold text-white">{item.quantity}</span>
                  <Button size="icon" variant="ghost" className="w-6 h-6 rounded-md" onClick={() => updateQuantity(item.itemId, 1)}>
                    <Plus className="w-2.5 h-2.5" />
                  </Button>
                </div>
                
                {item.category === "FOOD" && (
                  <div className="flex-1 px-3">
                    {item.isSent ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-bold py-1 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Fired to Kitchen
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => sendItemToKitchen(item.itemId)}
                        className="h-8 text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary/20 rounded-lg"
                      >
                        <CookingPot className="w-3 h-3 mr-1" /> Fire to Kitchen
                      </Button>
                    )}
                  </div>
                )}

                <span className="font-headline font-bold text-primary text-sm">₦{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-black/60 border-t border-white/10 space-y-4 shrink-0">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Switch 
              id="print-ducket" 
              checked={shouldPrintDucket} 
              onCheckedChange={setShouldPrintDucket}
            />
            <Label htmlFor="print-ducket" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1">
              <Printer className="w-3 h-3" /> Print Ducket
            </Label>
          </div>
          <div className="text-right">
            <span className="block text-[10px] font-headline font-bold text-muted-foreground uppercase tracking-widest leading-none">Total</span>
            <span className="text-2xl font-headline font-bold text-primary leading-tight">₦{total.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <Button 
            className="bg-primary text-primary-foreground font-bold h-12 rounded-xl px-2 text-[10px] sm:text-xs shadow-lg"
            disabled={cart.length === 0}
            onClick={() => handleCheckout('Card')}
          >
            <CreditCard className="w-4 h-4 mr-1.5" />
            Card
          </Button>
          <Button 
            variant="outline"
            className="border-primary/30 text-primary font-bold h-12 rounded-xl px-2 text-[10px] sm:text-xs hover:bg-primary/10 shadow-lg"
            disabled={cart.length === 0}
            onClick={() => handleCheckout('Transfer')}
          >
            <ArrowLeftRight className="w-4 h-4 mr-1.5" />
            Trans
          </Button>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl px-2 text-[10px] sm:text-xs shadow-lg"
            disabled={cart.length === 0}
            onClick={() => handleCheckout('Cash')}
          >
            <Banknote className="w-4 h-4 mr-1.5" />
            Cash
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-6 h-full max-w-[1600px] mx-auto pb-24 lg:pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">BAR SALES</h1>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full md:w-auto">
              <TabsList className="bg-white/5 border border-white/10 p-1 w-full sm:w-auto h-12">
                <TabsTrigger value="quick" className="flex-1 sm:flex-none gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <ShoppingCart className="w-4 h-4" /> Quick Sale
                </TabsTrigger>
                <TabsTrigger value="tables" className="flex-1 sm:flex-none gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <LayoutGrid className="w-4 h-4" /> Tables
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            {activeTab === "tables" && !selectedTable ? (
              <Card className="glass-card border-white/5">
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
                              <Clock className="w-3 h-3" /> Active
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
                      <LayoutGrid className="w-5 h-5 text-primary" />
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
                      <X className="w-4 h-4 mr-2" /> Release
                    </Button>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search inventory..." 
                    className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="mt-6 space-y-6">
                  {inventoryLoading ? (
                    <div className="py-20 text-center text-muted-foreground animate-pulse">Loading...</div>
                  ) : filteredItems.length === 0 ? (
                    <Card className="glass-card border-dashed border-white/10 bg-transparent">
                      <CardContent className="py-20 flex flex-col items-center text-center">
                        <Package className="w-8 h-8 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-headline font-bold mb-2">No items found</h3>
                        <Button asChild variant="outline" className="mt-4">
                          <Link href="/inventory">Go to Inventory</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        {paginatedItems.map(item => (
                          <div 
                            key={item.id} 
                            className="glass-card hover:border-primary/40 transition-all cursor-pointer p-4 flex items-center justify-between rounded-2xl border border-white/5"
                            onClick={() => addToCart(item)}
                          >
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{item.category}</span>
                              <span className="font-headline font-bold text-lg leading-tight text-white">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-6">
                              <span className="text-primary font-headline font-bold text-xl">₦{(item.price || 0).toLocaleString()}</span>
                              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                <Plus className="w-5 h-5" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                          <p className="text-xs text-muted-foreground">
                            {filteredItems.length} items
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="h-10 px-4 rounded-xl"
                            >
                              <ChevronLeft className="w-4 h-4" />
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
                              <ChevronRight className="w-4 h-4" />
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

          <div className="hidden lg:block w-[400px]">
            <Card className="glass-card flex flex-col h-[calc(100vh-220px)] sticky top-28 border-white/5 overflow-hidden">
              <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="font-headline font-bold text-lg text-white">
                  {selectedTable ? `Bill: ${selectedTable}` : "Cart"}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => {
                  setCart([]);
                  if(selectedTable) saveToTable([]);
                }} disabled={cart.length === 0}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CartUI />
            </Card>
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-6 left-6 right-6 z-50">
        <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
          <SheetTrigger asChild>
            <Button className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg shadow-2xl rounded-2xl flex justify-between px-6">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <span>View Cart</span>
                <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary-foreground border-none">
                  {cart.length}
                </Badge>
              </div>
              <span className="font-headline">₦{total.toLocaleString()}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] bg-background border-white/10 p-0 rounded-t-[2.5rem] overflow-hidden">
            <div className="flex flex-col h-full">
              <SheetHeader className="p-6 border-b border-white/5 flex flex-row items-center justify-between space-y-0">
                <SheetTitle className="font-headline font-bold text-xl text-white">
                  {selectedTable ? `Bill: ${selectedTable}` : "Order"}
                </SheetTitle>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive" onClick={() => {
                  setCart([]);
                  if(selectedTable) saveToTable([]);
                }} disabled={cart.length === 0}>
                  <Trash2 className="w-5 h-5" />
                </Button>
              </SheetHeader>
              <CartUI />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}
