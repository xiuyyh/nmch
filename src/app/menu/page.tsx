
"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit3, 
  Settings2,
  Filter
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const initialMenuItems = [
  { id: "1", name: "Old Fashioned", price: 14.00, category: "Cocktails", ingredients: 3, status: "Active" },
  { id: "2", name: "Margarita", price: 12.00, category: "Cocktails", ingredients: 4, status: "Active" },
  { id: "3", name: "IPA (Pint)", price: 8.50, category: "Beer", ingredients: 1, status: "Active" },
  { id: "4", name: "Truffle Fries", price: 12.00, category: "Food", ingredients: 2, status: "Active" },
  { id: "5", name: "House Red Wine", price: 11.00, category: "Wine", ingredients: 1, status: "Active" },
  { id: "6", name: "Espresso Martini", price: 16.00, category: "Cocktails", ingredients: 4, status: "Seasonal" },
];

export default function MenuPage() {
  const [items, setItems] = useState(initialMenuItems);
  const [search, setSearch] = useState("");

  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Menu Configuration</h1>
            <p className="text-muted-foreground">Configure items, pricing, and inventory mapping.</p>
          </div>
          <Button className="bg-secondary text-secondary-foreground neon-glow-secondary gap-2">
            <Plus className="w-4 h-4" />
            Create Menu Item
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search items..." 
              className="pl-10 bg-card border-border" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <Card key={item.id} className="glass-card group overflow-hidden border-border hover:border-primary/50 transition-all">
              <div className="h-2 w-full bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">{item.category}</Badge>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">{item.name}</CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-card border-border">
                    <DropdownMenuItem className="gap-2 cursor-pointer">
                      <Edit3 className="w-4 h-4" /> Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer">
                      <Settings2 className="w-4 h-4" /> Stock Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Price</span>
                    <span className="text-2xl font-headline font-bold text-secondary">${item.price.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-muted-foreground">Inventory Links</span>
                    <span className="text-sm font-medium">{item.ingredients} components</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <span className={item.status === "Active" ? "text-emerald-500 text-xs font-medium" : "text-amber-500 text-xs font-medium"}>
                    ● {item.status}
                  </span>
                  <Button variant="ghost" size="sm" className="text-xs h-8 px-2 hover:bg-primary/10 hover:text-primary">
                    View Recipe
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
