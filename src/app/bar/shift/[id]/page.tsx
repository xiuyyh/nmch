
"use client";

import React, { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ClipboardList, 
  User, 
  Clock, 
  ArrowRight,
  PackageCheck
} from "lucide-react";
import { useDoc, useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ShiftOpeningStockDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const firestore = useFirestore();

  const shiftRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "shifts", id as string);
  }, [firestore, id]);

  const { data: shift, loading } = useDoc(shiftRef);

  const groupedStock = useMemo(() => {
    if (!shift?.openingStock) return {};
    return shift.openingStock.reduce((acc: any, item: any) => {
      const cat = item.category || "General Inventory";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [shift]);

  const categories = useMemo(() => Object.keys(groupedStock).sort(), [groupedStock]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center animate-pulse text-muted-foreground font-headline font-bold">
          Accessing Secure Snapshot...
        </div>
      </AppShell>
    );
  }

  if (!shift) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
          <PackageCheck className="w-16 h-16 text-muted-foreground/20" />
          <h2 className="text-xl font-headline font-bold">Record Not Found</h2>
          <Button onClick={() => router.back()} variant="outline">Go Back</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/5">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Opening Stock Report</h1>
              <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Session ID: #{shift.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn(
            "px-4 py-1.5 rounded-full font-bold uppercase tracking-widest text-[10px]",
            shift.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-white/5 text-muted-foreground border-white/10"
          )}>
            {shift.status} Session
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <User className="w-3 h-3 text-primary" /> Staff on Duty
              </span>
              <CardTitle className="text-xl font-headline">{shift.staffName}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-3 h-3 text-primary" /> Start Time
              </span>
              <CardTitle className="text-xl font-headline">
                {shift.startTime?.toDate ? format(shift.startTime.toDate(), "MMM dd, HH:mm:ss") : "N/A"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <ClipboardList className="w-3 h-3 text-primary" /> Total Items
              </span>
              <CardTitle className="text-xl font-headline">{shift.openingStock?.length || 0} SKUs Snapshot</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="space-y-12">
          {categories.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground italic font-bold">No opening stock recorded for this session.</div>
          ) : (
            categories.map(category => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/5" />
                  <h2 className="text-xs font-bold text-primary uppercase tracking-[0.4em] whitespace-nowrap bg-black/40 px-6 py-2 rounded-full border border-white/5">
                    {category}
                  </h2>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedStock[category].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-colors group">
                      <div className="flex flex-col">
                        <span className="font-bold text-white group-hover:text-primary transition-colors">{item.name}</span>
                        <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">Bar Inventory Link</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                        <span className="text-2xl font-headline font-bold text-white bg-white/5 px-4 py-1 rounded-xl">
                          {item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.3em]">
            End of Session Opening Stock Audit Record
          </p>
        </div>
      </div>
    </AppShell>
  );
}
