
"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Printer, Send, ShoppingCart, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const suggestedRestock = [
  { id: "1", name: "Tito's Vodka", current: 2, min: 4, suggested: 6, cost: 24.50 },
  { id: "2", name: "Angostura Bitters", current: 1, min: 2, suggested: 2, cost: 12.00 },
  { id: "3", name: "IPA Keg", current: 4, min: 2, suggested: 2, cost: 180.00 },
  { id: "4", name: "Simple Syrup", current: 500, min: 2000, suggested: 5000, cost: 8.00 },
];

export default function RestockPage() {
  const { toast } = useToast();
  const [items, setItems] = useState(suggestedRestock);

  const handleSend = () => {
    toast({
      title: "Order Sent",
      description: "Restock request has been sent to the supplier and added to pending orders.",
    });
  };

  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Restock Requests</h1>
            <p className="text-muted-foreground">Generate purchase lists based on inventory thresholds.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Printer className="w-4 h-4" />
              Print List
            </Button>
            <Button className="bg-primary text-primary-foreground gap-2" onClick={handleSend}>
              <Send className="w-4 h-4" />
              Submit to Supplier
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="glass-card border-l-4 border-l-secondary">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-3 bg-secondary/20 rounded-xl">
                <Info className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <CardTitle>Automatic Order Suggestion</CardTitle>
                <p className="text-sm text-muted-foreground">Based on current sales velocity and minimum stock levels.</p>
              </div>
            </CardHeader>
          </Card>

          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-border bg-white/5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <span className="font-headline font-bold">Weekly Order List</span>
                </div>
                <Badge variant="outline" className="font-mono text-xs">#ORD-2023-1102</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-lg">{item.name}</span>
                        <span className="text-sm text-muted-foreground">Current: {item.current} | Min Target: {item.min}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col text-center">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Order Qty</span>
                        <span className="text-xl font-headline font-bold text-primary">+{item.suggested}</span>
                      </div>
                      <div className="flex flex-col text-right min-w-[100px]">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Est. Cost</span>
                        <span className="text-lg font-headline font-bold">${item.cost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="bg-white/5 border-t border-border p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Items to order: {items.length}</span>
                <span className="text-xs text-muted-foreground italic">Pricing is estimated based on last purchase records.</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-muted-foreground font-medium">Order Total:</span>
                <span className="text-3xl font-headline font-bold text-secondary">${totalCost.toFixed(2)}</span>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
