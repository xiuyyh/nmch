
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
  AlertTriangle
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
  updateDoc
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ITEMS_PER_PAGE = 10;

export default function WarehouseStockPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editCategory, setEditCategory] = useState<string>("");

  // Fetch Shared Categories from the Bar Inventory system
  const categoriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventoryCategories"), orderBy("name"));
  }, [firestore]);
  const { data: categories, loading: categoriesLoading } = useCollection(categoriesQuery);

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

  const handleAddCategory = async () => {
    if (!firestore || !newCategoryName.trim()) return;
    try {
      await addDoc(collection(firestore, "inventoryCategories"), {
        name: newCategoryName.trim().toUpperCase()
      });
      setNewCategoryName("");
      toast({ title: "Category Added", description: "Successfully added new category." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add category." });
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "inventoryCategories", id));
      toast({ title: "Category Deleted", description: `Category ${name} removed.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete category." });
    }
  };

  const handleUpdateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !editingItem) return;

    const formData = new FormData(e.currentTarget);
    const updatedData = {
      name: formData.get("name") as string,
      category: editCategory,
      stock: Number(formData.get("stock")),
      min: Number(formData.get("min")),
      unit: formData.get("unit") as string,
      lastUpdated: serverTimestamp()
    };

    try {
      const itemRef = doc(firestore, "warehouseInventory", editingItem.id);
      await updateDoc(itemRef, updatedData);
      setIsEditOpen(false);
      setEditingItem(null);
      toast({ title: "Item Updated", description: `${updatedData.name} updated.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Update failed." });
    }
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
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Warehouse Stock</h1>
            <p className="text-muted-foreground">Manage main store inventory and bulk stock levels.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isManageCategoriesOpen} onOpenChange={setIsManageCategoriesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 h-12 px-6 rounded-xl border-white/10">
                  <Settings2 className="w-4 h-4" /> Manage Categories
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-white/10 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-headline flex items-center gap-2">
                    <Tags className="w-5 h-5 text-primary" /> Shared Categories
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="NEW CATEGORY..." 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="bg-white/5 border-white/10 uppercase"
                    />
                    <Button onClick={handleAddCategory} className="bg-primary text-primary-foreground font-bold">
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {categoriesLoading ? (
                      <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
                    ) : (
                      categories?.filter(c => c.name !== "FOOD").map(cat => (
                        <div key={cat.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                          <span className="font-bold text-sm">{cat.name}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button asChild className="bg-primary text-primary-foreground gap-2 h-12 px-6 rounded-xl shadow-lg font-bold">
              <Link href="/store/warehouse/add">
                <Plus className="w-4 h-4" /> Add Warehouse Item
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
              <div className="py-20 text-center text-muted-foreground italic">No warehouse items found.</div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/5 h-12">
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Category</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Stock Level</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Min Threshold</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => {
                      const isLow = item.stock <= item.min;
                      return (
                        <TableRow key={item.id} className="border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-bold text-sm">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-white/5 text-[10px] border-white/10">
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
                            {item.min}
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
            <DialogTitle className="text-xl font-headline">Update Warehouse Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form onSubmit={handleUpdateItem} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-name">Item Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editingItem.name} required className="bg-white/5 h-12" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Category</Label>
                  <Select value={editCategory} onValueChange={setEditCategory} required>
                    <SelectTrigger className="bg-white/5 h-12">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="glass-card">
                      {categories?.filter(c => c.name !== "FOOD").map(cat => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-unit">Unit</Label>
                  <Input id="edit-unit" name="unit" defaultValue={editingItem.unit} required className="bg-white/5 h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stock">Stock</Label>
                  <Input id="edit-stock" name="stock" type="number" defaultValue={editingItem.stock} required className="bg-white/5 h-12" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-min">Min Threshold</Label>
                  <Input id="edit-min" name="min" type="number" defaultValue={editingItem.min} required className="bg-white/5 h-12" />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full h-12">Apply Updates</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
