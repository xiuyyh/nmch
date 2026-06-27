"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Trash2, 
  Save, 
  ChevronLeft, 
  Banknote,
  LayoutList,
  Loader2,
  Building2,
  Tags
} from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { sendTelegramNotification } from "@/lib/notifications";

interface ExpenseItem {
  name: string;
  cost: number;
}

export default function NewExpensePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseType, setExpenseType] = useState("");
  const [apartmentName, setApartmentName] = useState("");
  const [items, setItems] = useState<ExpenseItem[]>([{ name: "", cost: 0 }]);

  const addItem = () => {
    setItems([...items, { name: "", cost: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || isSubmitting) return;

    if (!expenseType.trim()) {
      toast({ variant: "destructive", title: "Missing Type", description: "Please enter the type of expense." });
      return;
    }

    const validItems = items.filter(i => i.name.trim() !== "");
    if (validItems.length === 0) {
      toast({ variant: "destructive", title: "Missing Items", description: "Please add at least one item description." });
      return;
    }

    setIsSubmitting(true);
    const staffName = user.displayName || user.email;

    const expenseData = {
      type: expenseType.trim(),
      apartmentName: apartmentName.trim() || "Hotel General",
      amount: totalAmount,
      items: validItems,
      details: `Admin logged expense: ${expenseType}. Breakdown: ${validItems.map(i => i.name).join(", ")}`,
      staffName,
      staffId: user.uid,
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "expenses"), expenseData);
      
      // Telegram Notification
      const itemBreakdown = validItems.map(i => `- ${i.name}: ₦${i.cost.toLocaleString()}`).join('\n');
      const telegramMsg = `💸 *NEW EXPENSE LOGGED*\n\n*Type:* ${expenseData.type}\n*Target:* ${expenseData.apartmentName}\n*Grand Total:* ₦${totalAmount.toLocaleString()}\n\n*Items:*\n${itemBreakdown}\n\n*By:* ${staffName}`;
      sendTelegramNotification(firestore, telegramMsg);

      toast({ title: "Expense Saved", description: `Recorded ₦${totalAmount.toLocaleString()} outflow successfully.` });
      router.push("/admin/expenses");
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to log expense record." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/5">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">Log Expense</h1>
              <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">New Financial Record</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <LayoutList className="text-primary w-5 h-5" /> Detailed Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {items.map((item, index) => (
                    <div key={index} className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-white/5 rounded-xl border border-white/5 animate-in slide-in-from-left-2 duration-300">
                      <div className="flex-1 w-full space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Item Description</Label>
                        <Input 
                          placeholder="e.g. Printer Ink, Lightbulbs..." 
                          value={item.name}
                          onChange={(e) => updateItem(index, "name", e.target.value)}
                          className="bg-white/5 border-white/10 h-11"
                        />
                      </div>
                      <div className="w-full sm:w-32 space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Cost (₦)</Label>
                        <Input 
                          type="number"
                          placeholder="0"
                          value={item.cost}
                          onChange={(e) => updateItem(index, "cost", Number(e.target.value))}
                          className="bg-white/5 border-white/10 h-11 text-right font-bold"
                        />
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-11 w-11 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full border-dashed border-white/10 h-12 gap-2 text-muted-foreground hover:text-primary hover:border-primary/50"
                    onClick={addItem}
                  >
                    <Plus className="w-4 h-4" /> Add Another Item
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1">
                      <Tags className="w-3 h-3" /> Expense Category/Type
                    </Label>
                    <Input 
                      placeholder="e.g. Maintenance, Office, etc." 
                      value={expenseType}
                      onChange={(e) => setExpenseType(e.target.value)}
                      className="bg-white/5 border-primary/20 h-12 font-bold uppercase text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Target Apartment/Unit
                    </Label>
                    <Input 
                      placeholder="e.g. Reception, Flat 12" 
                      value={apartmentName}
                      onChange={(e) => setApartmentName(e.target.value)}
                      className="bg-white/5 border-white/10 h-12"
                    />
                  </div>

                  <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Calculated Total</span>
                    <span className="text-3xl font-headline font-bold text-white">₦{totalAmount.toLocaleString()}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 pb-8">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full h-16 bg-primary text-primary-foreground font-bold text-lg rounded-2xl shadow-xl uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Log Expense</>}
                  </Button>
                </CardFooter>
              </Card>
              
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3">
                 <Banknote className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-muted-foreground leading-relaxed">
                   Saving this record will permanently add the outflow to the company ledger and notify the management Telegram channel.
                 </p>
              </div>
            </div>
          </form>
        </div>
      </AppShell>
    </RoleGuard>
  );
}