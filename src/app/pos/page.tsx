
"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const categories = ["All", "Cocktails", "Beer", "Wine", "Food", "Spirits"];

const menuItems = [
  { id: "1", name: "Old Fashioned", price: 14.00, category: "Cocktails" },
  { id: "2", name: "Margarita", price: 12.00, category: "Cocktails" },
  { id: "3", name: "IPA (Pint)", price: 8.50, category: "Beer" },
  { id: "4", name: "Lager (Pint)", price: 7.00, category: "Beer" },
  { id: "5", name: "Chardonnay", price: 11.00, category: "Wine" },
  { id: "6", name: "Cabernet", price: 12.00, category: "Wine" },
  { id: "7", name: "Truffle Fries", price: 12.00, category: "Food" },
  { id: "8", name: "Sliders", price: 15.00, category: "Food" },
];

export default function POSPage() {
  const [cart, setCart] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const addToCart = (item: typeof menuItems[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = (method: string) => {
    toast({
      title: "Sale Recorded",
      description: `Successfully processed ${method} payment of $${total.toFixed(2)}`,
    });
    setCart([]);
  };

  return (
    <AppShell>
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Menu Selection Section */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search menu items..." 
              className="pl-10 bg-card border-border" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Tabs defaultValue="All" className="w-full">
            <TabsList className="bg-card/50 p-1">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map(cat => (
              <TabsContent key={cat} value={cat} className="mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {menuItems
                    .filter(item => (cat === "All" || item.category === cat) && item.name.toLowerCase().includes(search.toLowerCase()))
                    .map(item => (
                      <Card 
                        key={item.id} 
                        className="glass-card hover:border-primary transition-colors cursor-pointer group"
                        onClick={() => addToCart(item)}
                      >
                        <CardContent className="p-4 flex flex-col gap-2">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-primary font-headline font-bold">${item.price.toFixed(2)}</span>
                          <Button size="sm" variant="ghost" className="mt-2 group-hover:bg-primary group-hover:text-primary-foreground">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Cart Sidebar */}
        <div className="w-full lg:w-96 flex flex-col h-full">
          <Card className="glass-card flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="font-headline font-bold text-lg">Current Sale</h2>
              <Button variant="ghost" size="sm" onClick={() => setCart([])} disabled={cart.length === 0}>
                Clear
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <ShoppingCart className="w-12 h-12 mb-2" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm">{item.name}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="w-6 h-6" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="w-6 h-6" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="font-headline font-bold text-primary">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-white/5 border-t border-border space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total</span>
                <span className="text-secondary font-headline">${total.toFixed(2)}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  className="bg-primary text-primary-foreground neon-glow-primary hover:opacity-90"
                  disabled={cart.length === 0}
                  onClick={() => handleCheckout('Card')}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Card
                </Button>
                <Button 
                  className="bg-secondary text-secondary-foreground neon-glow-secondary hover:opacity-90"
                  disabled={cart.length === 0}
                  onClick={() => handleCheckout('Cash')}
                >
                  <Banknote className="w-4 h-4 mr-2" />
                  Cash
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
