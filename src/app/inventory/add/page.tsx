
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ChevronLeft, Package, Save } from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function AddInventoryItemPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Fetch Categories dynamically from Firestore
  const categoriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventoryCategories"), orderBy("name"));
  }, [firestore]);
  const { data: categories } = useCollection(categoriesQuery);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const category = selectedCategory;
    const isFood = category === "FOOD";

    const name = formData.get("name") as string;
    const stock = isFood ? 0 : Number(formData.get("stock"));
    const min = isFood ? 0 : Number(formData.get("min"));
    const price = Number(formData.get("price"));
    const unit = isFood ? "N/A" : (formData.get("unit") as string);

    const newItem = {
      name,
      category,
      stock,
      min,
      price,
      unit,
      lastUpdated: serverTimestamp()
    };

    // Create a new document reference with a generated ID so we can use the same ID for mirroring
    const inventoryCol = collection(firestore, "inventory");
    const itemRef = doc(inventoryCol);

    setDoc(itemRef, newItem)
      .then(async () => {
        // Mirror to Warehouse Inventory (unless it's Food)
        if (!isFood) {
          const warehouseRef = doc(firestore, "warehouseInventory", itemRef.id);
          const warehouseData = {
            name,
            category,
            unit,
            stock: 0, // Starts at 0 until updated via Warehouse Intake
            min: 5,   // Default warehouse threshold
            lastUpdated: serverTimestamp()
          };
          
          setDoc(warehouseRef, warehouseData).catch(error => {
            errorEmitter.emit("permission-error", new FirestorePermissionError({
              path: warehouseRef.path,
              operation: "create",
              requestResourceData: warehouseData
            }));
          });
        }

        toast({
          title: "Item Added",
          description: `${name} added to bar inventory and mirrored to warehouse.`,
        });
        router.push("/inventory");
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: itemRef.path,
          operation: "create",
          requestResourceData: newItem
        }));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Add New Item</h1>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Item Specifications
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleAddItem}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Item Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="e.g. Heineken" 
                    required 
                    className="bg-white/5 border-white/10 h-12" 
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/10 max-h-[300px]">
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.name} className="focus:bg-primary focus:text-primary-foreground">{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="price" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Sales Price (₦)</Label>
                  <Input 
                    id="price" 
                    name="price" 
                    type="number" 
                    step="1" 
                    placeholder="0"
                    required 
                    className="bg-white/5 border-white/10 h-12" 
                  />
                </div>

                {selectedCategory !== "FOOD" && selectedCategory !== "" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="unit" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Unit</Label>
                      <Input 
                        id="unit" 
                        name="unit" 
                        placeholder="Bottle / Can / Pack" 
                        required 
                        className="bg-white/5 border-white/10 h-12" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Initial Stock</Label>
                      <Input 
                        id="stock" 
                        name="stock" 
                        type="number" 
                        step="1" 
                        placeholder="0"
                        required 
                        className="bg-white/5 border-white/10 h-12" 
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="min" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Min Stock Threshold (Alert)</Label>
                      <Input 
                        id="min" 
                        name="min" 
                        type="number" 
                        step="1" 
                        placeholder="10"
                        required 
                        className="bg-white/5 border-white/10 h-12" 
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg shadow-xl"
              >
                {isSubmitting ? "Creating Item..." : (
                  <>
                    <Save className="w-5 h-5 mr-2" /> Save to Inventory
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
