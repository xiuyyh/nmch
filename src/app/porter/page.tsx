
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
  Backpack, 
  Utensils, 
  ConciergeBell, 
  ClipboardCheck, 
  Clock, 
  User, 
  Building2,
  Activity,
  Plus,
  Loader2,
  AlertTriangle,
  History,
  Coffee,
  DoorOpen,
  Package
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ActionType = "guest_check" | "complimentary_meal" | "room_delivery";

export default function PorterHubPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeAction, setActiveAction] = useState<ActionType>("guest_check");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Shift Check
  const shiftQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "porterShifts"),
      where("staffId", "==", user.uid),
      where("status", "==", "active"),
      limit(1)
    );
  }, [firestore, user]);
  const { data: shifts, loading: shiftLoading } = useCollection(shiftQuery);
  const activeShift = shifts?.[0];

  // 2. Apartments for selection
  const apartmentsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "apartments"), orderBy("name"));
  }, [firestore]);
  const { data: apartments } = useCollection(apartmentsQuery);

  // 3. Recent Actions
  const actionsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "porterActions"), orderBy("timestamp", "desc"), limit(20));
  }, [firestore]);
  const { data: recentActions } = useCollection(actionsQuery);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || !activeShift || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    let actionData: any = {
      type: activeAction,
      timestamp: serverTimestamp(),
      staffName: user.displayName || user.email,
      shiftId: activeShift.id
    };

    if (activeAction === "complimentary_meal") {
      const count = formData.get("totalMeals") as string;
      actionData = {
        ...actionData,
        apartmentId: "SYSTEM",
        apartmentName: "Hotel Wide",
        roomNumber: "N/A",
        details: `Total Served: ${count} breakfasts`
      };
    } else if (activeAction === "guest_check") {
      const apartmentId = formData.get("apartmentId") as string;
      const apartment = apartments?.find(a => a.id === apartmentId);
      const roomCount = formData.get("roomCount") as string;
      actionData = {
        ...actionData,
        apartmentId,
        apartmentName: apartment?.name || "Unknown",
        roomNumber: "ALL",
        details: `Checked ${roomCount} rooms in apartment`
      };
    } else if (activeAction === "room_delivery") {
      const apartmentId = formData.get("apartmentId") as string;
      const apartment = apartments?.find(a => a.id === apartmentId);
      const itemName = formData.get("itemName") as string;
      actionData = {
        ...actionData,
        apartmentId,
        apartmentName: apartment?.name || "Unknown",
        roomNumber: formData.get("roomNumber") || "General",
        details: `Delivered: ${itemName}`
      };
    }

    try {
      await addDoc(collection(firestore, "porterActions"), actionData);
      toast({ title: "Activity Logged", description: "Record saved to system history." });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save entry." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (shiftLoading) return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse font-bold text-muted-foreground">SYNCING DUTY HUB...</div></AppShell>;

  if (!activeShift) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-headline font-bold">Duty Hub Closed</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">You must sign in to your shift before logging any activities or services.</p>
          </div>
          <Button asChild className="h-14 px-8 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl">
            <a href="/porter/shift">Go to Shift Management</a>
          </Button>
        </div>
      </AppShell>
    );
  }

  const actionTypes = [
    { id: "guest_check", label: "Guest Check", icon: DoorOpen, color: "text-blue-500" },
    { id: "complimentary_meal", label: "Breakfast Service", icon: Coffee, color: "text-emerald-500" },
    { id: "room_delivery", label: "Room Delivery", icon: Package, color: "text-amber-500" },
  ];

  return (
    <RoleGuard allowedRoles={["porter", "admin"]}>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Backpack className="w-8 h-8 text-primary" /> Porter Duty Log
              </h1>
              <p className="text-muted-foreground mt-1">Record guest checks, meal counts, and room deliveries.</p>
            </div>
            <div className="bg-primary/10 border border-primary/20 px-6 py-3 rounded-2xl flex items-center gap-4">
              <User className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">On Duty</span>
                <span className="text-sm font-bold text-white">{activeShift.staffName}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-3 gap-4">
                {actionTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setActiveAction(type.id as ActionType)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex flex-col items-center gap-3",
                      activeAction === type.id 
                        ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(var(--primary),0.1)]" 
                        : "bg-white/5 border-white/5 hover:border-white/10"
                    )}
                  >
                    <type.icon className={cn("w-6 h-6", activeAction === type.id ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-widest text-center", activeAction === type.id ? "text-white" : "text-muted-foreground")}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>

              <Card className="glass-card overflow-hidden">
                <CardHeader className="bg-white/[0.02] border-b border-white/5">
                  <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" /> 
                    {actionTypes.find(t => t.id === activeAction)?.label}
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="pt-8 space-y-6">
                    {activeAction === "complimentary_meal" && (
                      <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Breakfasts Served Today</Label>
                        <Input name="totalMeals" type="number" required placeholder="Enter total quantity" className="bg-white/5 border-white/10 h-14 text-2xl font-bold" />
                      </div>
                    )}

                    {activeAction === "guest_check" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Apartment Checked</Label>
                          <Select name="apartmentId" required>
                            <SelectTrigger className="bg-white/5 border-white/10 h-12">
                              <SelectValue placeholder="Select Flat" />
                            </SelectTrigger>
                            <SelectContent className="glass-card border-white/10">
                              {apartments?.map(apt => (
                                <SelectItem key={apt.id} value={apt.id}>{apt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Number of Rooms Checked</Label>
                          <Input name="roomCount" type="number" required placeholder="e.g. 3" className="bg-white/5 border-white/10 h-12" />
                        </div>
                      </div>
                    )}

                    {activeAction === "room_delivery" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Destination Apartment</Label>
                          <Select name="apartmentId" required>
                            <SelectTrigger className="bg-white/5 border-white/10 h-12">
                              <SelectValue placeholder="Select Flat" />
                            </SelectTrigger>
                            <SelectContent className="glass-card border-white/10">
                              {apartments?.map(apt => (
                                <SelectItem key={apt.id} value={apt.id}>{apt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Item Name/Details</Label>
                          <Input name="itemName" required placeholder="e.g. 2 Bottles of Water" className="bg-white/5 border-white/10 h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Specific Room (Optional)</Label>
                          <Input name="roomNumber" placeholder="e.g. Room A" className="bg-white/5 border-white/10 h-12" />
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="bg-white/[0.01] border-t border-white/5 pt-6 pb-8">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full h-16 bg-primary text-primary-foreground font-bold text-lg rounded-2xl shadow-xl uppercase tracking-widest"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <><Plus className="w-5 h-5 mr-2" /> Log Activity</>}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="space-y-8">
              <Card className="glass-card flex flex-col h-full min-h-[600px]">
                <CardHeader className="bg-white/5 border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Session History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto max-h-[700px]">
                  {recentActions?.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground opacity-30 italic px-6">No recent entries recorded.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {recentActions?.map((action) => (
                        <div key={action.id} className="p-5 space-y-2 hover:bg-white/[0.02] transition-colors">
                          <div className="flex justify-between items-start">
                            <Badge variant="outline" className={cn(
                              "text-[8px] uppercase px-1.5 h-4 border-none",
                              action.type === 'guest_check' ? "bg-blue-500/20 text-blue-400" :
                              action.type === 'complimentary_meal' ? "bg-emerald-500/20 text-emerald-400" :
                              "bg-amber-500/20 text-amber-400"
                            )}>
                              {action.type.replace('_', ' ')}
                            </Badge>
                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">
                              {action.timestamp?.toDate ? format(action.timestamp.toDate(), "HH:mm") : "..."}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">
                              {action.apartmentName} {action.roomNumber !== 'N/A' && `— ${action.roomNumber}`}
                            </span>
                            <p className="text-[10px] text-muted-foreground leading-snug">{action.details}</p>
                          </div>
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
