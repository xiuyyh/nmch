
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CookingPot, 
  Clock, 
  User, 
  LayoutGrid,
  ChefHat,
  CheckCircle2,
  Undo2
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function KitchenOrdersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  const toggleDeliveryStatus = async (orderId: string, currentStatus: string) => {
    if (!firestore) return;
    setProcessingId(orderId);

    const newStatus = currentStatus === "Delivered" ? "Pending" : "Delivered";
    const orderRef = doc(firestore, "kitchenOrders", orderId);
    
    const updateData = {
      status: newStatus,
      deliveredAt: newStatus === "Delivered" ? serverTimestamp() : null
    };

    updateDoc(orderRef, updateData)
      .then(() => {
        toast({
          title: newStatus === "Delivered" ? "Order Delivered" : "Order Reopened",
          description: `Order #${orderId.slice(-6).toUpperCase()} status updated.`,
        });
      })
      .catch(error => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: orderRef.path,
          operation: "update",
          requestResourceData: updateData
        }));
      })
      .finally(() => setProcessingId(null));
  };

  const activeOrdersCount = orders?.filter(o => o.status !== "Delivered").length || 0;

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
                {activeOrdersCount} ACTIVE
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
            {orders?.map((order) => {
              const isDelivered = order.status === "Delivered";
              return (
                <Card 
                  key={order.id} 
                  className={cn(
                    "glass-card overflow-hidden border-l-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
                    isDelivered ? "border-l-muted opacity-60 scale-[0.98]" : "border-l-primary"
                  )}
                >
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
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "font-bold px-2 py-0.5 transition-colors",
                          isDelivered 
                            ? "bg-muted text-muted-foreground border-muted-foreground/20" 
                            : "bg-primary/10 text-primary border-primary/20"
                        )}
                      >
                        {order.status || "Pending"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-6 space-y-4">
                    <div className="space-y-3">
                      {order.items?.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                          <span className={cn("font-bold text-lg leading-tight", isDelivered ? "text-muted-foreground line-through" : "text-white")}>
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">QTY:</span>
                            <span className={cn("text-2xl font-headline font-bold", isDelivered ? "text-muted-foreground" : "text-primary")}>
                              {item.quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <div className="px-6 pb-6 pt-0 flex flex-col gap-4">
                    <Button 
                      onClick={() => toggleDeliveryStatus(order.id, order.status)}
                      disabled={processingId === order.id}
                      className={cn(
                        "w-full h-12 font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all",
                        isDelivered 
                          ? "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white" 
                          : "bg-primary text-primary-foreground hover:opacity-90"
                      )}
                    >
                      {isDelivered ? (
                        <>
                          <Undo2 className="w-4 h-4 mr-2" /> Reopen Order
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Delivered
                        </>
                      )}
                    </Button>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                      <User className="w-3 h-3" /> Ordered by: {order.staffName}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
