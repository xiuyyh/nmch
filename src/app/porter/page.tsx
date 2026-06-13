
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

  const apartmentsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "apartments"), orderBy("name"));
  }, [firestore]);
  const { data: apartments } = useCollection(apartmentsQuery);

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
        details: `Checked ${roomCount} rooms`
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
      toast({ title: "Recorded", description: "Activity logged successfully." });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save entry." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (shiftLoading) return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse">Connecting...</div></AppShell>;

  if (!activeShift) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-6 p-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <h2 className="text-2xl font-headline font-bold">Duty Session Closed</h2>
          <Button asChild className="h-14 px-8 w-full max-w-xs bg-primary font-bold rounded-2xl shadow-xl">
            <a href="/porter/shift">Start Shift First</a>
          </Button>
        </div>
      </AppShell>
    );
  }

  const actionTypes = [
    { id: "guest_check", label: "Check-In", icon: DoorOpen },
    { id: "complimentary_meal", label: "Meals", icon: Coffee },
    { id: "room_delivery", label: "Delivery", icon: Package },
  ];

  return (
    <RoleGuard allowedRoles={["porter", "admin"]}>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <Backpack className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> Duty Hub
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Log room checks, breakfast service, and guest deliveries.</p>
            </div>
            <div className="bg-primary/10 border border-primary/20 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl flex items-center gap-3 w-full sm:w-auto">
              <User className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest block leading-none">Duty Personnel</span>
                <span className="text-xs sm:text-sm font-bold text-white truncate block">{activeShift.staffName}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {actionTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setActiveAction(type.id as ActionType)}
                    className={cn(
                      "p-3 sm:p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 sm:gap-3",
                      activeAction === type.id 
                        ? "bg-primary/10 border-primary shadow-lg scale-[1.02]" 
                        : "bg-white/5 border-white/5 hover:border-white/10"
                    )}
                  >
                    <type.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", activeAction === type.id ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-center", activeAction === type.id ? "text-white" : "text-muted-foreground")}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>

              <Card className="glass-card">
                <CardHeader className="bg-white/[0.02] border-b border-white/5 p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg font-headline flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" /> 
                    {actionTypes.find(t => t.id === activeAction)?.label} Details
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="pt-6 sm:pt-8 space-y-6 p-4 sm:p-6">
                    {activeAction === "complimentary_meal" && (
                      <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Breakfasts Served</Label>
                        <Input name="totalMeals" type="number" required placeholder="0" className="bg-white/5 border-white/10 h-14 text-2xl font-bold" />
                      </div>
                    )}

                    {activeAction === "guest_check" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Flat Name</Label>
                          <Select name="apartmentId" required>
                            <SelectTrigger className="bg-white/5 border-white/10 h-12">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="glass-card border-white/10">
                              {apartments?.map(apt => (
                                <SelectItem key={apt.id} value={apt.id}>{apt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Rooms Checked</Label>
                          <Input name="roomCount" type="number" required placeholder="e.g. 3" className="bg-white/5 border-white/10 h-12" />
                        </div>
                      </div>
                    )}

                    {activeAction === "room_delivery" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Flat</Label>
                          <Select name="apartmentId" required>
                            <SelectTrigger className="bg-white/5 border-white/10 h-12">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="glass-card border-white/10">
                              {apartments?.map(apt => (
                                <SelectItem key={apt.id} value={apt.id}>{apt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Specific Room</Label>
                          <Input name="roomNumber" placeholder="e.g. A" className="bg-white/5 border-white/10 h-12" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Items Delivered</Label>
                          <Input name="itemName" required placeholder="e.g. Cold Water, Extra Towel" className="bg-white/5 border-white/10 h-12" />
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="bg-white/[0.01] border-t border-white/5 p-4 sm:p-6 pb-6 sm:pb-8">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full h-16 bg-primary text-primary-foreground font-bold text-lg rounded-2xl shadow-xl uppercase tracking-widest"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" /> : "Log Entry"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card flex flex-col h-full min-h-[400px]">
                <CardHeader className="bg-white/5 border-b border-white/5 p-4">
                  <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <History className="w-4 h-4 text-primary" /> Session Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto max-h-[500px]">
                  {recentActions?.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground opacity-30 italic px-6 text-sm">No entries yet.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {recentActions?.map((action) => (
                        <div key={action.id} className="p-4 space-y-2 hover:bg-white/[0.02]">
                          <div className="flex justify-between items-start">
                            <Badge variant="outline" className={cn(
                              "text-[7px] sm:text-[8px] uppercase px-1.5 h-4 border-none",
                              action.type === 'guest_check' ? "bg-blue-500/20 text-blue-400" :
                              action.type === 'complimentary_meal' ? "bg-emerald-500/20 text-emerald-400" :
                              "bg-amber-500/20 text-amber-400"
                            )}>
                              {action.type.replace('_', ' ')}
                            </Badge>
                            <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase">
                              {action.timestamp?.toDate ? format(action.timestamp.toDate(), "HH:mm") : "..."}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-white truncate">
                              {action.apartmentName} {action.roomNumber !== 'N/A' && `— ${action.roomNumber}`}
                            </span>
                            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{action.details}</p>
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
