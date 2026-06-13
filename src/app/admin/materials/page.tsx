
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
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
import { 
  Settings2, 
  Plus, 
  Trash2, 
  WashingMachine, 
  Warehouse,
  CheckCircle2,
  PackageSearch
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function MaterialConfigPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const materialsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "requestableMaterials"), orderBy("name"));
  }, [firestore]);

  const { data: materials, loading } = useCollection(materialsQuery);

  const handleAddMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const source = formData.get("source") as string;

    try {
      await addDoc(collection(firestore, "requestableMaterials"), {
        name: name.trim(),
        source,
        createdAt: serverTimestamp()
      });
      toast({ title: "Material Configured", description: `${name} can now be requested from ${source}.` });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add material." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, "requestableMaterials", id));
    toast({ title: "Removed", description: "Material removed from request options." });
  };

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-10">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <Settings2 className="w-8 h-8 text-primary" /> Requestable Materials
            </h1>
            <p className="text-muted-foreground mt-1">Configure which supplies Housekeeping can request from Laundry and Store.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" /> Add New Material
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleAddMaterial}>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Material Name</Label>
                      <Input name="name" required placeholder="e.g. Bed Sheets (Double)" className="bg-white/5 h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Sourcing Department</Label>
                      <Select name="source" required defaultValue="Laundry">
                        <SelectTrigger className="bg-white/5 h-12">
                          <SelectValue placeholder="Select Source" />
                        </SelectTrigger>
                        <SelectContent className="glass-card border-white/10">
                          <SelectItem value="Laundry" className="gap-2">
                            <div className="flex items-center gap-2"><WashingMachine className="w-4 h-4" /> Laundry</div>
                          </SelectItem>
                          <SelectItem value="Store">
                            <div className="flex items-center gap-2"><Warehouse className="w-4 h-4" /> Main Store</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-xl">
                      {isSubmitting ? "Adding..." : "Save Material Config"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5">
                   <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                     <PackageSearch className="w-4 h-4" /> Current Configuration
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-20 text-center animate-pulse">Loading config...</div>
                  ) : materials?.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground italic px-6">No materials configured yet.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {materials?.map(m => (
                        <div key={m.id} className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                          <div className="flex flex-col">
                            <span className="font-bold text-white uppercase text-sm">{m.name}</span>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                              {m.source === 'Laundry' ? <WashingMachine className="w-3 h-3 text-primary" /> : <Warehouse className="w-3 h-3 text-amber-500" />}
                              Source: {m.source}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
