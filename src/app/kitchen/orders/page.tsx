
"use client";

import React, { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CookingPot, 
  Clock, 
  User, 
  LayoutGrid,
  ChefHat
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function KitchenOrdersPage() {
  const firestore = useFirestore();

  // Fetch Kitchen Orders in real-time
  const ordersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "kitchenOrders"), 
      orderBy("timestamp", "desc"),
      limit(50)
    );
  }, [firestore]);

  const { data: orders, loading } = useCollection(ordersQuery);

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-primary" /> Kitchen Orders
            </h1>
            <p className="text-muted-foreground mt-1">Live feed of food orders coming from the bar.</p>
          </div>
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Queue Status</span>
              <span className="text-xl font-headline font-bold text-primary">
                {orders?.length || 0} ACTIVE
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
            <CookingPot className="w-12 h-12 text-primary animate-bounce" />
            <p className="font-headline font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
              Connecting to Bar...
            </p>
          </div>
        ) : orders?.length === 0 ? (
          <div className="py-32 text-center flex flex-col items-center justify-center opacity-40">
            <CookingPot className="w-20 h-20 mb-6" />
            <h3 className="text-2xl font-headline font-bold">The Kitchen is Quiet</h3>
            <p className="text-sm italic mt-2">No active food orders at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders?.map((order) => (
              <Card key={order.id} className="glass-card overflow-hidden border-l-4 border-l-primary animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="bg-white/[0.02] border-b border-white/5 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-primary" />
                        <span className="font-headline font-bold text-xl text-white">
                          {order.tableNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-widest">
                          {order.timestamp?.toDate ? format(order.timestamp.toDate(), "HH:mm:ss") : "Just now"}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold px-2 py-0.5">
                      NEW
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-6 space-y-4">
                  <div className="space-y-3">
                    {order.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="font-bold text-lg text-white leading-tight">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">QTY:</span>
                          <span className="text-2xl font-headline font-bold text-primary">
                            {item.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardContent className="pt-0 pb-4 border-t border-white/5 bg-white/[0.01]">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mt-3">
                    <User className="w-3 h-3" /> Ordered by: {order.staffName}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
