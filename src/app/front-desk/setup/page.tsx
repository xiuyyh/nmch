
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Home, 
  Plus, 
  Trash2, 
  Save, 
  LayoutGrid, 
  Zap,
  Loader2,
  Settings2,
  Building2,
  Edit2,
  X
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, doc, deleteDoc, writeBatch, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ApartmentSetupPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickSetting, setIsQuickSetting] = useState(false);
  const [editingApartment, setEditingApartment] = useState<any>(null);

  const apartmentsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "apartments"), orderBy("name"));
  }, [firestore]);

  const { data: apartments, loading } = useCollection(apartmentsQuery);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || isSubmitting) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const roomsStr = formData.get("rooms") as string;
    const roomNumbers = roomsStr.split(",").map(r => r.trim()).filter(Boolean);

    if (roomNumbers.length === 0) {
      toast({ variant: "destructive", title: "Missing Rooms", description: "Please enter at least one room number." });
      return;
    }

    setIsSubmitting(true);
    
    const apartmentData = {
      name,
      type,
      roomNumbers,
      lastModified: serverTimestamp()
    };

    if (editingApartment) {
      const docRef = doc(firestore, "apartments", editingApartment.id);
      updateDoc(docRef, apartmentData)
        .then(() => {
          toast({ title: "Apartment Updated", description: `${name} configuration has been saved.` });
          setEditingApartment(null);
          (e.target as HTMLFormElement).reset();
        })
        .finally(() => setIsSubmitting(false));
    } else {
      addDoc(collection(firestore, "apartments"), {
        ...apartmentData,
        createdAt: serverTimestamp()
      })
        .then(() => {
          toast({ title: "Apartment Added", description: `${name} has been configured.` });
          (e.target as HTMLFormElement).reset();
        })
        .finally(() => setIsSubmitting(false));
    }
  };

  const handleQuickSetup = async () => {
    if (!firestore || !user) return;
    setIsQuickSetting(true);

    const batch = writeBatch(firestore);
    const colRef = collection(firestore, "apartments");

    // 10 x 3-bed
    for (let i = 1; i <= 10; i++) {
      const docRef = doc(colRef);
      batch.set(docRef, {
        name: `Flat ${i}`,
        type: "3-bed",
        roomNumbers: [`F${i}-A`, `F${i}-B`, `F${i}-C`],
        createdAt: serverTimestamp()
      });
    }

    // 2 x 2-bed
    for (let i = 11; i <= 12; i++) {
      const docRef = doc(colRef);
      batch.set(docRef, {
        name: `Flat ${i}`,
        type: "2-bed",
        roomNumbers: [`F${i}-A`, `F${i}-B`],
        createdAt: serverTimestamp()
      });
    }

    // 1 x 1-bed
    const docRef = doc(colRef);
    batch.set(docRef, {
      name: `Flat 13`,
      type: "1-bed",
      roomNumbers: [`F13-A`],
      createdAt: serverTimestamp()
    });

    batch.commit().then(() => {
      toast({ title: "Quick Setup Complete", description: "13 apartments have been generated." });
    }).finally(() => setIsQuickSetting(false));
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    deleteDoc(doc(firestore, "apartments", id)).then(() => {
      toast({ title: "Deleted", description: "Apartment configuration removed." });
      if (editingApartment?.id === id) setEditingApartment(null);
    });
  };

  const startEditing = (apt: any) => {
    setEditingApartment(apt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Settings2 className="w-8 h-8 text-primary" /> Apartment Setup
              </h1>
              <p className="text-muted-foreground mt-1">Configure your hospitality units and room assignments.</p>
            </div>
            
            <Button 
              onClick={handleQuickSetup} 
              disabled={isQuickSetting || (apartments && apartments.length > 0)}
              className="bg-amber-600 hover:bg-amber-700 h-12 rounded-xl gap-2 font-bold shadow-xl px-6"
            >
              {isQuickSetting ? <Loader2 className="animate-spin w-4 h-4" /> : <Zap className="w-4 h-4" />}
              Bootstrap Default 13 Flats
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <Card className={cn(
                "glass-card sticky top-28 transition-all duration-500",
                editingApartment && "border-primary/40 ring-1 ring-primary/20"
              )}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editingApartment ? <Edit2 className="text-primary w-5 h-5" /> : <Plus className="text-primary w-5 h-5" />}
                      {editingApartment ? "Edit Apartment" : "Define New Flat"}
                    </div>
                    {editingApartment && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingApartment(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <form key={editingApartment?.id || 'new'} onSubmit={handleSubmit}>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Apartment Name</Label>
                      <Input name="name" defaultValue={editingApartment?.name} placeholder="e.g. Flat 1" required className="bg-white/5 border-white/10 h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Unit Type</Label>
                      <Select name="type" defaultValue={editingApartment?.type || "3-bed"}>
                        <SelectTrigger className="bg-white/5 border-white/10 h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-card border-white/10">
                          <SelectItem value="1-bed">1-Bedroom</SelectItem>
                          <SelectItem value="2-bed">2-Bedroom</SelectItem>
                          <SelectItem value="3-bed">3-Bedroom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Constituent Room Numbers</Label>
                      <Input 
                        name="rooms" 
                        defaultValue={editingApartment?.roomNumbers?.join(", ")} 
                        placeholder="101, 102, 103" 
                        required 
                        className="bg-white/5 border-white/10 h-11" 
                      />
                      <p className="text-[9px] text-muted-foreground/60 italic leading-tight">Enter room numbers separated by commas. These will be individually bookable.</p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3">
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-lg">
                      <Save className="w-4 h-4 mr-2" /> {editingApartment ? "Save Changes" : "Save Configuration"}
                    </Button>
                    {editingApartment && (
                      <Button type="button" variant="ghost" onClick={() => setEditingApartment(null)} className="w-full text-muted-foreground h-10">
                        Cancel Edit
                      </Button>
                    )}
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-headline font-bold flex items-center gap-2 text-white">
                <LayoutGrid className="w-5 h-5 text-primary" /> Current Inventory
              </h2>
              
              {loading ? (
                <div className="py-20 text-center animate-pulse text-muted-foreground font-bold uppercase tracking-widest">Scanning Units...</div>
              ) : apartments?.length === 0 ? (
                <div className="py-32 text-center flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl opacity-40">
                  <Building2 className="w-16 h-16 mb-4" />
                  <p className="font-bold uppercase tracking-widest text-sm">No apartments configured yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {apartments?.map(apt => (
                    <Card key={apt.id} className={cn(
                      "glass-card hover:border-primary/20 transition-all group relative",
                      editingApartment?.id === apt.id && "border-primary ring-1 ring-primary/40"
                    )}>
                      <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            editingApartment?.id === apt.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                          )}>
                            <Home className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-headline">{apt.name}</CardTitle>
                            <Badge variant="outline" className="text-[8px] uppercase h-4 px-1 border-white/10 text-muted-foreground">{apt.type}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEditing(apt)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(apt.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Bookable Rooms:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {apt.roomNumbers.map((room: string) => (
                            <Badge key={room} variant="outline" className="bg-white/5 border-white/10 text-[10px] font-mono px-2 py-0.5">
                              {room}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
