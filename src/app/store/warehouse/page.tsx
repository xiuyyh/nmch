
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Warehouse, 
  Settings2, 
  Trash2,
  Tags,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  deleteDoc,
  updateDoc,
  getDocs,
  setDoc
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const ITEMS_PER_PAGE = 10;

export default function WarehouseStockPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editCategory, setEditCategory] = useState<string>("");

  // Fetch Warehouse Inventory
  const warehouseQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "warehouseInventory"), orderBy("name"));
  }, [firestore]);
  const { data: stockItems, loading } = useCollection(warehouseQuery);

  const filteredItems = useMemo(() => {
    if (!stockItems) return [];
    return stockItems.filter(item => 
      item.name?.toLowerCase().includes(search.toLowerCase()) || 
      item.category?.toLowerCase().includes(search.toLowerCase())
    );
  }, [stockItems, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const handleSyncMissingItems = async () => {
    if (!firestore) return;
    setIsSyncing(true);

    try {
      const barInventorySnap = await getDocs(collection(firestore, "inventory"));
      const warehouseInventorySnap = await getDocs(collection(firestore, "warehouseInventory"));
      
      const warehouseIds = new Set(warehouseInventorySnap.docs.map(doc => doc.id));
      let syncCount = 0;

      for (const barDoc of barInventorySnap.docs) {
        const data = barDoc.data();
        // Don't sync FOOD or items that already exist in warehouse
        if (!warehouseIds.has(barDoc.id) && data.category !== "FOOD") {
          const warehouseRef = doc(firestore, "warehouseInventory", barDoc.id);
          await setDoc(warehouseRef, {
            name: data.name,
            category: data.category,
            unit: data.unit || "N/A",
            stock: 0,
            min: 5,
            lastUpdated: serverTimestamp()
          });
          syncCount++;
        }
      }

      toast({
        title: "Sync Complete",
        description: `Successfully imported ${syncCount} missing items from bar inventory.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Could not synchronize missing items. Please check permissions.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !editingItem) return;

    const formData = new FormData(e.currentTarget);
    const updatedData = {
      stock: Number(formData.get("stock")),
      min: Number(formData.get("min")),
      lastUpdated: serverTimestamp()
    };

    const itemRef = doc(firestore, "warehouseInventory", editingItem.id);
    updateDoc(itemRef, updatedData)
      .then(() => {
        setIsEditOpen(false);
        setEditingItem(null);
        toast({ title: "Stock Updated", description: `${editingItem.name} levels adjusted.` });
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: itemRef.path,
          operation: "update",
          requestResourceData: updatedData
        }));
      });
  };

  const openEditDialog = (item: any) => {
    setEditingItem(item);
    setEditCategory(item.category);
    setIsEditOpen(true);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">Warehouse Stock</h1>
            <p className="text-muted-foreground">Main store stock levels. Items are mirrored from Bar Inventory definitions.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleSyncMissingItems} 
              disabled={isSyncing}
              className="gap-2 h-12 px-6 rounded-xl border-white/10"
            >
              <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
              {isSyncing ? "Syncing..." : "Sync Missing Items"}
            </Button>
            <Button asChild className="bg-primary text-primary-foreground gap-2 h-12 px-6 rounded-xl shadow-lg font-bold">
              <Link href="/store/suppliers">
                <Plus className="w-4 h-4" /> Process Intake
              </Link>
            </Button>
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-primary" /> Warehouse Inventory
              </CardTitle>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search warehouse..." 
                  className="pl-10 h-10 bg-white/5 border-white/10 rounded-xl" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center text-muted-foreground animate-pulse font-headline font-bold uppercase">Gathering warehouse data...</div>
            ) : filteredItems?.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground italic flex flex-col items-center gap-4">
                <p>No warehouse items found.</p>
                <p className="text-xs">Add items to the Bar Inventory first, or use "Sync Missing Items" above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/5 h-12">
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Category</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Warehouse Stock</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Warehouse Threshold</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => {
                      const isLow = item.stock <= (item.min || 0);
                      return (
                        <TableRow key={item.id} className="border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-bold text-sm">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-white/5 text-[10px] border-white/10 uppercase">
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn("font-headline font-bold text-lg", isLow && "text-destructive")}>
                              {item.stock}
                            </span> 
                            <span className="text-[10px] text-muted-foreground ml-1 uppercase font-bold">{item.unit}</span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground font-bold">
                            {item.min || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="hover:text-primary">
                              <Settings2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/5">
                    <p className="text-xs text-muted-foreground font-bold uppercase">
                      {filteredItems.length} Warehouse Records
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-10 px-4 rounded-xl border-white/10"
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
                        className="h-10 px-4 rounded-xl border-white/10"
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

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass-card border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline">Update Warehouse Stock</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form onSubmit={handleUpdateItem} className="space-y-6 py-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-white uppercase tracking-widest">{editingItem.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{editingItem.category}</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-stock" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Current Stock ({editingItem.unit})</Label>
                  <Input id="edit-stock" name="stock" type="number" defaultValue={editingItem.stock} required className="bg-white/5 h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-min" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Warehouse Reorder Threshold</Label>
                  <Input id="edit-min" name="min" type="number" defaultValue={editingItem.min || 5} required className="bg-white/5 h-12" />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full h-12 font-bold uppercase tracking-widest text-xs">Apply Updates</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
