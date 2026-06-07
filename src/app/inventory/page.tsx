
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Edit2, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 5;

export default function InventoryPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const inventoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventory"), orderBy("name"));
  }, [firestore]);

  const { data: stockItems, loading } = useCollection(inventoryQuery);

  const filteredItems = useMemo(() => {
    if (!stockItems) return [];
    return stockItems.filter(item => 
      item.name?.toLowerCase().includes(search.toLowerCase()) || 
      item.category?.toLowerCase().includes(search.toLowerCase())
    );
  }, [stockItems, search]);

  // Reset to first page when searching
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const stats = useMemo(() => {
    if (!stockItems) return { lowStock: 0 };
    return {
      lowStock: stockItems.filter(item => item.stock <= item.min).length
    };
  }, [stockItems]);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const newItem = {
      name: formData.get("name") as string,
      category: formData.get("category") as string,
      stock: Number(formData.get("stock")),
      min: Number(formData.get("min")),
      unit: formData.get("unit") as string,
      lastUpdated: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "inventory"), newItem);
      setIsAddOpen(false);
      toast({
        title: "Item Added",
        description: `${newItem.name} has been added to inventory.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add inventory item.",
      });
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Bar Inventory</h1>
            <p className="text-muted-foreground">Manage and track your bar stock levels in real-time.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Sync
            </Button>
            
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground gap-2">
                  <Plus className="w-4 h-4" /> Add Stock Item
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-white/10">
                <DialogHeader>
                  <DialogTitle>Add New Inventory Item</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddItem} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="name">Item Name</Label>
                      <Input id="name" name="name" placeholder="e.g. Tito's Vodka" required className="bg-white/5" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input id="category" name="category" placeholder="Spirits" required className="bg-white/5" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Input id="unit" name="unit" placeholder="Bottles/ml" required className="bg-white/5" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock">Initial Stock</Label>
                      <Input id="stock" name="stock" type="number" step="0.01" required className="bg-white/5" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min">Min Threshold</Label>
                      <Input id="min" name="min" type="number" step="0.01" required className="bg-white/5" />
                    </div>
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full">Save Item</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">{stockItems?.length || 0} Total</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive font-headline">{stats.lowStock} Items</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary font-headline">Live Tracking</div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Stock</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter stock..." 
                  className="pl-10 h-9 bg-background/50 border-white/5" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">Loading stock data...</div>
            ) : filteredItems?.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground italic">No inventory items found. Add your first item to begin tracking.</div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead className="font-bold">Item Name</TableHead>
                      <TableHead className="font-bold">Category</TableHead>
                      <TableHead className="font-bold">Current Stock</TableHead>
                      <TableHead className="font-bold">Threshold</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => {
                      const isLow = item.stock <= item.min;
                      return (
                        <TableRow key={item.id} className="border-white/5 hover:bg-white/5">
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.category}</TableCell>
                          <TableCell>
                            <span className={cn("font-headline font-bold", isLow && "text-destructive")}>{item.stock.toFixed(2)}</span> {item.unit}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.min} {item.unit}</TableCell>
                          <TableCell>
                            {isLow ? (
                              <Badge variant="destructive" className="gap-1 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                Healthy
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <p className="text-xs text-muted-foreground">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length} items
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-1 text-sm font-medium px-2">
                        {currentPage} / {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
