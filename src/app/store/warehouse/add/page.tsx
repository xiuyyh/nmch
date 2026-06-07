
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
import { ChevronLeft, Warehouse, Save } from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function AddWarehouseItemPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Fetch Categories
  const categoriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "warehouseCategories"), orderBy("name"));
  }, [firestore]);
  const { data: categories } = useCollection(categoriesQuery);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    const newItem = {
      name: formData.get("name") as string,
      category: selectedCategory,
      stock: Number(formData.get("stock")),
      min: Number(formData.get("min")),
      unit: formData.get("unit") as string,
      lastUpdated: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "warehouseInventory"), newItem);
      toast({
        title: "Warehouse Item Added",
        description: `${newItem.name} added successfully.`,
      });
      router.push("/store/warehouse");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add item to warehouse.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">New Warehouse Item</h1>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-primary" />
              Main Store Specifications
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
                    placeholder="e.g. Bulk Heineken (Cartons)" 
                    required 
                    className="bg-white/5 border-white/10 h-12" 
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12">
                      <SelectValue placeholder="Select Warehouse Category" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/10 max-h-[300px]">
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.name} className="focus:bg-primary focus:text-primary-foreground">{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Unit (e.g. Carton, Box)</Label>
                  <Input 
                    id="unit" 
                    name="unit" 
                    placeholder="Carton" 
                    required 
                    className="bg-white/5 border-white/10 h-12" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Initial Stock Count</Label>
                  <Input 
                    id="stock" 
                    name="stock" 
                    type="number" 
                    placeholder="0"
                    required 
                    className="bg-white/5 border-white/10 h-12" 
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="min" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Critical Reorder Threshold</Label>
                  <Input 
                    id="min" 
                    name="min" 
                    type="number" 
                    placeholder="5"
                    required 
                    className="bg-white/5 border-white/10 h-12" 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg shadow-xl"
              >
                {isSubmitting ? "Processing..." : (
                  <>
                    <Save className="w-5 h-5 mr-2" /> Save to Warehouse
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
