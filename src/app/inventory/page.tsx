
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
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
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
  Edit2, 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  Settings2, 
  Trash2,
  Tags,
  RefreshCcw,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  getDocs,
  where,
  increment
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const ITEMS_PER_PAGE = 10;

export default function InventoryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editCategory, setEditCategory] = useState<string>("");
  
  const [isReconciling, setIsReconciling] = useState(false);

  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userRecord } = useDoc(userRef);
  const isAdmin = userRecord?.role === 'admin';

  const categoriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventoryCategories"), orderBy("name"));
  }, [firestore]);
  const { data: categories, loading: categoriesLoading } = useCollection(categoriesQuery);

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

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const stats = useMemo(() => {
    if (!stockItems) return { lowStock: 0 };
    return {
      lowStock: stockItems.filter(item => item.category !== "FOOD" && item.stock <= item.min).length
    };
  }, [stockItems]);

  const handleUpdateItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !editingItem || !user) return;

    const formData = new FormData(e.currentTarget);
    const category = editCategory;
    const isFood = category === "FOOD";

    const name = formData.get("name") as string;
    const stock = isFood ? 0 : Number(formData.get("stock"));
    const min = isFood ? 0 : Number(formData.get("min"));
    const price = Number(formData.get("price"));
    const unit = isFood ? "N/A" : (formData.get("unit") as string);

    const updatedData = {
      name,
      category,
      stock,
      min,
      price,
      unit,
      lastUpdated: serverTimestamp()
    };

    const itemRef = doc(firestore, "inventory", editingItem.id);
    updateDoc(itemRef, updatedData)
      .then(() => {
        addDoc(collection(firestore, "adminActions"), {
          adminName: user.displayName || user.email,
          adminId: user.uid,
          action: "UPDATE_ITEM",
          entity: "INVENTORY",
          details: `Updated ${editingItem.name}. New Price: ₦${price.toLocaleString()}, New Stock: ${stock} ${unit}`,
          timestamp: serverTimestamp()
        }).catch(() => {});

        if (!isFood) {
          const warehouseRef = doc(firestore, "warehouseInventory", editingItem.id);
          setDoc(warehouseRef, {
            name,
            category,
            unit,
            lastUpdated: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }

        setIsEditOpen(false);
        setEditingItem(null);
        toast({ title: "Item Updated", description: `${name} updated successfully.` });
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: itemRef.path,
          operation: "update",
          requestResourceData: updatedData
        }));
      });
  };

  const handleAddCategory = () => {
    if (!firestore || !newCategoryName.trim() || !user) return;
    const categoryData = { name: newCategoryName.trim().toUpperCase() };
    addDoc(collection(firestore, "inventoryCategories"), categoryData)
      .then(() => {
        addDoc(collection(firestore, "adminActions"), {
          adminName: user.displayName || user.email,
          adminId: user.uid,
          action: "CREATE_CATEGORY",
          entity: "CATEGORY",
          details: `Created new inventory category: ${categoryData.name}`,
          timestamp: serverTimestamp()
        }).catch(() => {});
        setNewCategoryName("");
        toast({ title: "Category Added", description: "Successfully added new category." });
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "inventoryCategories",
          operation: "create",
          requestResourceData: categoryData
        }));
      });
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (!firestore || !user) return;
    const categoryRef = doc(firestore, "inventoryCategories", id);
    deleteDoc(categoryRef)
      .then(() => {
        addDoc(collection(firestore, "adminActions"), {
          adminName: user.displayName || user.email,
          adminId: user.uid,
          action: "DELETE_CATEGORY",
          entity: "CATEGORY",
          details: `Deleted inventory category: ${name}`,
          timestamp: serverTimestamp()
        }).catch(() => {});
        toast({ title: "Category Deleted", description: `Category ${name} removed.` });
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: categoryRef.path,
          operation: "delete"
        }));
      });
  };

  const handleReconcileLegacySales = () => {
    if (!firestore || !user || !isAdmin) return;
    setIsReconciling(true);

    const salesQuery = query(
      collection(firestore, "sales"),
      where("status", "!=", "Canceled")
    );

    getDocs(salesQuery).then((snap) => {
      const unreconciledSales = snap.docs.filter(d => !d.data().isReconciled);
      
      if (unreconciledSales.length === 0) {
        toast({ title: "Reconciliation Complete", description: "No legacy sales found that require deduction." });
        setIsReconciling(false);
        return;
      }

      let totalDeductedItems = 0;
      const promises: Promise<any>[] = [];

      unreconciledSales.forEach((saleDoc) => {
        const sale = saleDoc.data();
        sale.items?.forEach((item: any) => {
          // Double check category if possible, but mainly skip known food
          const invItem = stockItems?.find(si => si.id === item.itemId);
          if (invItem && invItem.category !== "FOOD") {
            const stockRef = doc(firestore, "inventory", item.itemId);
            promises.push(updateDoc(stockRef, { stock: increment(-item.quantity), lastUpdated: serverTimestamp() }));
            totalDeductedItems += item.quantity;
          }
        });
        
        promises.push(updateDoc(doc(firestore, "sales", saleDoc.id), { isReconciled: true }));
      });

      Promise.all(promises).then(() => {
        addDoc(collection(firestore, "adminActions"), {
          adminName: user.displayName || user.email,
          adminId: user.uid,
          action: "RECONCILE_INVENTORY",
          entity: "INVENTORY",
          details: `Performed manual reconciliation of ${unreconciledSales.length} legacy sales. Total items deducted: ${totalDeductedItems}`,
          timestamp: serverTimestamp()
        }).catch(() => {});

        toast({ title: "Success", description: `Deducted ${totalDeductedItems} items from ${unreconciledSales.length} legacy sales.` });
      }).finally(() => setIsReconciling(false));
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
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">Bar Inventory</h1>
            <p className="text-muted-foreground">Manage stock levels and sales pricing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button 
                variant="outline" 
                onClick={handleReconcileLegacySales} 
                disabled={isReconciling}
                className="gap-2 h-12 px-6 rounded-xl border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10"
              >
                {isReconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Reconcile Legacy Sales
              </Button>
            )}
            
            <Dialog open={isManageCategoriesOpen} onOpenChange={setIsManageCategoriesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 h-12 px-6 rounded-xl border-white/10">
                  <Settings2 className="w-4 h-4" /> Manage Categories
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-white/10 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-headline flex items-center gap-2">
                    <Tags className="w-5 h-5 text-primary" /> Category Manager
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
                    <Button onClick={handleAddCategory} className="bg-primary text-primary-foreground font-bold">Add</Button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {categoriesLoading ? (
                      <p className="text-xs text-muted-foreground animate-pulse">Loading categories...</p>
                    ) : categories?.map(cat => (
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
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button asChild className="bg-primary text-primary-foreground gap-2 h-12 px-6 rounded-xl shadow-lg font-bold">
              <Link href="/inventory/add"><Plus className="w-4 h-4" /> Add New Item</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Inventory Items</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold font-headline">{stockItems?.length || 0}</div></CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Critical Low Stock</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-destructive font-headline">{stats.lowStock} Alerts</div></CardContent>
          </Card>
        </div>

        {isAdmin && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
             <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
             <div className="space-y-1">
               <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Legacy Inventory Correction</p>
               <p className="text-[10px] text-muted-foreground leading-relaxed">
                 Use the <strong>"Reconcile Legacy Sales"</strong> button above if items sold before the automatic deduction system was implemented are still showing in your stock count. This tool will subtract those items once and mark the sales as reconciled.
               </p>
             </div>
          </div>
        )}

        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> Stock & Pricing
              </CardTitle>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter inventory..." 
                  className="pl-10 h-10 bg-white/5 border-white/10 rounded-xl" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center text-muted-foreground animate-pulse font-headline font-bold uppercase tracking-widest">Gathering stock data...</div>
            ) : filteredItems?.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground italic">No items matching your search.</div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/5 h-12">
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Category</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Price</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Current Stock</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Threshold</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => {
                      const isFood = item.category === "FOOD";
                      const isLow = !isFood && item.stock <= item.min;
                      return (
                        <TableRow key={item.id} className="border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-bold text-sm">{item.name}</TableCell>
                          <TableCell><Badge variant="outline" className="bg-white/5 text-[10px] border-white/10 uppercase">{item.category}</Badge></TableCell>
                          <TableCell className="text-right font-headline font-bold text-primary text-lg">₦{(item.price || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {isFood ? (
                              <span className="text-xs text-muted-foreground italic font-medium">N/A</span>
                            ) : (
                              <><span className={cn("font-headline font-bold text-lg", isLow && "text-destructive")}>{item.stock.toFixed(0)}</span> <span className="text-[10px] text-muted-foreground ml-1 uppercase font-bold">{item.unit}</span></>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground font-bold">{isFood ? "-" : item.min}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="hover:bg-primary/10 hover:text-primary"><Edit2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/5">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{filteredItems.length} Records</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-10 px-4 rounded-xl border-white/10"><ChevronLeft className="w-4 h-4" /></Button>
                      <div className="flex items-center gap-1 text-sm font-bold px-4 bg-primary/10 rounded-xl text-primary">{currentPage} / {totalPages}</div>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-10 px-4 rounded-xl border-white/10"><ChevronRight className="w-4 h-4" /></Button>
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
          <DialogHeader><DialogTitle className="text-xl font-headline">Update Item</DialogTitle></DialogHeader>
          {editingItem && (
            <form onSubmit={handleUpdateItem} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-name" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Item Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editingItem.name} required className="bg-white/5 border-white/10 h-12" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Category</Label>
                  <Select value={editCategory} onValueChange={setEditCategory} required>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent className="glass-card border-white/10 max-h-[300px]">
                      {categories?.map(cat => <SelectItem key={cat.id} value={cat.name} className="focus:bg-primary focus:text-primary-foreground">{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-price" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Price (₦)</Label>
                  <Input id="edit-price" name="price" type="number" step="1" defaultValue={editingItem.price} required className="bg-white/5 border-white/10 h-12" />
                </div>
                {editCategory !== "FOOD" && (
                  <>
                    <div className="space-y-2"><Label htmlFor="edit-unit" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Unit</Label><Input id="edit-unit" name="unit" defaultValue={editingItem.unit} required className="bg-white/5 border-white/10 h-12" /></div>
                    <div className="space-y-2"><Label htmlFor="edit-stock" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Stock</Label><Input id="edit-stock" name="stock" type="number" defaultValue={editingItem.stock} required className="bg-white/5 border-white/10 h-12" /></div>
                    <div className="space-y-2 col-span-2"><Label htmlFor="edit-min" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Threshold</Label><Input id="edit-min" name="min" type="number" defaultValue={editingItem.min} required className="bg-white/5 border-white/10 h-12" /></div>
                  </>
                )}
              </div>
              <DialogFooter className="pt-4"><Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-xl">Apply Updates</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
