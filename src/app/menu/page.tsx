"use client";

import React, { useState, useMemo } from "react";
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
  Filter,
  Package
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function MenuPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Fetch Menu
  const menuQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "menu"), orderBy("name"));
  }, [firestore]);
  const { data: menuItems, loading } = useCollection(menuQuery);

  // Fetch Inventory for ingredient selection
  const stockQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventory"), orderBy("name"));
  }, [firestore]);
  const { data: stockItems } = useCollection(stockQuery);

  const filtered = menuItems?.filter(item => 
    item.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.category?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleCreateMenuItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const newItem = {
      name: formData.get("name") as string,
      price: Number(formData.get("price")),
      category: formData.get("category") as string,
      status: "Active",
      ingredients: [], // Mapping happens in detailed edit
      lastUpdated: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "menu"), newItem);
      setIsCreateOpen(false);
      toast({
        title: "Menu Item Created",
        description: `${newItem.name} has been added to the active menu.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create menu item.",
      });
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Menu Configuration</h1>
            <p className="text-muted-foreground">Configure items, pricing, and inventory mapping.</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-secondary-foreground neon-glow-secondary gap-2">
                <Plus className="w-4 h-4" /> Create Menu Item
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10">
              <DialogHeader>
                <DialogTitle>New Menu Item</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateMenuItem} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name</Label>
                  <Input id="name" name="name" placeholder="e.g. Espresso Martini" required className="bg-white/5" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input id="category" name="category" placeholder="Cocktails" required className="bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (₦)</Label>
                    <Input id="price" name="price" type="number" step="0.01" required className="bg-white/5" />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full">Create Item</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search menu..." 
              className="pl-10 bg-white/5 border-white/5 focus:border-primary/50" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" /> Filter
          </Button>
        </div>

        {loading ? (
          <div className="py-20 text-center animate-pulse text-muted-foreground">Gathering menu data...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center italic text-muted-foreground">No menu items found. Start by creating a new cocktail or dish.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <Card key={item.id} className="glass-card group overflow-hidden border-white/5 hover:border-primary/50 transition-all">
                <div className="h-2 w-full bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider border-white/10">{item.category}</Badge>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{item.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-card border-white/10">
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Edit3 className="w-4 h-4" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Package className="w-4 h-4" /> Link Inventory
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Price</span>
                      <span className="text-2xl font-headline font-bold text-secondary">₦{item.price.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs text-muted-foreground">Inventory Links</span>
                      <span className="text-sm font-medium">{item.ingredients?.length || 0} active links</span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className={item.status === "Active" ? "text-emerald-500 text-xs font-medium" : "text-amber-500 text-xs font-medium"}>
                      ● {item.status}
                    </span>
                    <Button variant="ghost" size="sm" className="text-xs h-8 px-2 hover:bg-primary/10 hover:text-primary">
                      Manage Recipe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
