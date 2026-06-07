"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  FileText,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  ChevronDown,
  ShoppingCart,
  XCircle,
  RotateCcw,
  MinusCircle
} from "lucide-react";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, increment, serverTimestamp, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

const ITEMS_PER_PAGE = 10;

export default function SalesHistoryPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const salesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "sales"), orderBy("timestamp", "desc"));
  }, [firestore]);

  const { data: sales, loading } = useCollection(salesQuery);

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter(sale => 
      sale.tableNumber?.toLowerCase().includes(search.toLowerCase()) || 
      sale.method?.toLowerCase().includes(search.toLowerCase()) ||
      sale.items?.some((i: any) => i.name?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [sales, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

  const stats = useMemo(() => {
    if (!sales) return { total: 0, count: 0 };
    const activeSales = sales.filter(s => s.status !== "Canceled");
    return {
      total: activeSales.reduce((sum, s) => sum + (s.total || 0), 0),
      count: activeSales.length
    };
  }, [sales]);

  const checkSettlement = async (timestamp: any) => {
    if (!firestore || !timestamp) return true;
    const dateStr = format(timestamp.toDate(), "yyyy-MM-dd");
    const closingRef = doc(firestore, "dailyClosings", dateStr);
    const closingSnap = await getDoc(closingRef);
    return closingSnap.exists();
  };

  const handleCancelSale = async (sale: any) => {
    if (!firestore) return;

    const isSettled = await checkSettlement(sale.timestamp);
    if (isSettled) {
      toast({
        variant: "destructive",
        title: "Cancellation Denied",
        description: `The sales for this day have been settled and locked.`,
      });
      return;
    }

    try {
      await updateDoc(doc(firestore, "sales", sale.id), {
        status: "Canceled",
        canceledAt: serverTimestamp()
      });

      for (const item of sale.items) {
        const stockRef = doc(firestore, "inventory", item.itemId);
        await updateDoc(stockRef, {
          stock: increment(item.quantity),
          lastUpdated: serverTimestamp()
        });
      }

      toast({
        title: "Sale Canceled",
        description: `Inventory restored and transaction marked as canceled.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not cancel sale. Check permissions.",
      });
    }
  };

  const handleVoidItem = async (sale: any, itemIndex: number) => {
    if (!firestore) return;

    const isSettled = await checkSettlement(sale.timestamp);
    if (isSettled) {
      toast({
        variant: "destructive",
        title: "Action Denied",
        description: `The sales for this day are already settled.`,
      });
      return;
    }

    const itemToVoid = sale.items[itemIndex];
    const updatedItems = sale.items.filter((_: any, i: number) => i !== itemIndex);
    const updatedTotal = updatedItems.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);

    try {
      if (updatedItems.length === 0) {
        await updateDoc(doc(firestore, "sales", sale.id), {
          status: "Canceled",
          canceledAt: serverTimestamp(),
          items: [],
          total: 0
        });
      } else {
        await updateDoc(doc(firestore, "sales", sale.id), {
          items: updatedItems,
          total: updatedTotal
        });
      }

      const stockRef = doc(firestore, "inventory", itemToVoid.itemId);
      await updateDoc(stockRef, {
        stock: increment(itemToVoid.quantity),
        lastUpdated: serverTimestamp()
      });

      toast({
        title: "Item Voided",
        description: `${itemToVoid.name} removed and stock restored.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not void item.",
      });
    }
  };

  const printDucket = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'PPP p') : 'N/A';
    const itemsHtml = sale.items.map((item: any) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 800; font-size: 16px;">
        <span>${item.name} x ${item.quantity}</span>
        <span>₦${(item.price * item.quantity).toLocaleString()}</span>
      </div>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Ducket #${sale.id.slice(-6)}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              font-family: 'Arial', sans-serif; 
              width: 80mm; 
              padding: 10mm; 
              font-size: 14px; 
              color: #000;
              line-height: 1.4;
            }
            .center { text-align: center; }
            .bold { font-weight: 900; }
            .divider { border-bottom: 2px solid #000; margin: 10px 0; }
            .header { font-size: 24px; font-weight: 900; margin-bottom: 6px; text-transform: uppercase; }
            .subheader { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
            .total { font-size: 22px; font-weight: 900; margin-top: 12px; border-top: 2px solid #000; padding-top: 8px; }
            .meta { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
          </style>
        </head>
        <body>
          <div class="center header">NIGHTINGALE HOTEL</div>
          <div class="center subheader">${sale.status === 'Canceled' ? 'CANCELED DUCKET' : 'Duplicate Ducket'}</div>
          <div class="divider"></div>
          <div class="meta">DATE: ${dateStr}</div>
          <div class="meta">REC#: ${sale.id.slice(-8).toUpperCase()}</div>
          <div class="meta">SERV: ${sale.tableNumber}</div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="total" style="display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>₦${sale.total.toLocaleString()}</span>
          </div>
          <div class="meta" style="margin-top: 8px; font-size: 16px;">PAYMENT: ${sale.method}</div>
          <div class="divider"></div>
          <div class="center bold" style="margin-top: 15px; font-size: 16px;">*** ${sale.status === 'Canceled' ? 'VOID' : 'DUPLICATE'} ***</div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Card': return <CreditCard className="w-3 h-3" />;
      case 'Cash': return <Banknote className="w-3 h-3" />;
      case 'Transfer': return <ArrowLeftRight className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Sales History</h1>
            <p className="text-muted-foreground">Audit transactions and manage cancellations.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-white/10" asChild>
              <Link href="/bar/sales">
                <ShoppingCart className="w-4 h-4" /> New Sale
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Total Valid Revenue</div>
              <div className="text-2xl font-bold font-headline mt-1 text-primary">
                ₦{stats.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Successful Sales</div>
              <div className="text-2xl font-bold font-headline mt-1">{stats.count}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <FileText className="text-primary w-5 h-5" /> Transactions
              </CardTitle>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter sales..." 
                  className="pl-10 h-10 bg-white/5 border-white/5" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center animate-pulse text-muted-foreground">Fetching records...</div>
            ) : filteredSales.length === 0 ? (
              <div className="py-20 text-center italic text-muted-foreground">No transactions found.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {paginatedSales.map((sale) => (
                  <Collapsible key={sale.id} className="group">
                    <div className={cn(
                      "p-4 flex items-center justify-between hover:bg-white/5 transition-colors",
                      sale.status === "Canceled" && "opacity-60 bg-red-500/[0.02]"
                    )}>
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Receipt</span>
                          <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                            #{sale.id.slice(-8).toUpperCase()}
                            {sale.status === "Canceled" && (
                              <Badge variant="destructive" className="h-4 text-[8px] uppercase px-1">Canceled</Badge>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Time</span>
                          <span className="text-sm font-medium">
                            {sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'HH:mm') : 'N/A'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Table</span>
                          <span className="text-sm font-medium text-primary">{sale.tableNumber}</span>
                        </div>
                        <div className="flex flex-col items-end md:items-start">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total</span>
                          <span className={cn(
                            "text-lg font-headline font-bold text-white",
                            sale.status === "Canceled" && "line-through text-muted-foreground"
                          )}>₦{sale.total.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-primary" onClick={() => printDucket(sale)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10">
                            <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                    
                    <CollapsibleContent className="bg-white/[0.02] px-6 py-4 border-t border-white/5">
                      <div className="max-w-md space-y-4">
                        <div className="space-y-3">
                          <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] border-b border-white/10 pb-2">
                            <span>Items</span>
                            <span>Subtotal</span>
                          </div>
                          {sale.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm group/item">
                              <span className="text-white/80">
                                {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                                {sale.status !== "Canceled" && (
                                  <button 
                                    onClick={() => handleVoidItem(sale, idx)}
                                    className="ml-2 text-destructive opacity-0 group-hover/item:opacity-100 transition-opacity"
                                    title="Void this item"
                                  >
                                    <MinusCircle className="w-3.5 h-3.5 inline" />
                                  </button>
                                )}
                              </span>
                              <span className="font-headline font-bold">₦{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="pt-3 flex items-center justify-between border-t border-white/5">
                          <Badge variant="outline" className="gap-1.5 border-white/10 text-[10px] uppercase font-bold py-1">
                            {getMethodIcon(sale.method)} {sale.method}
                          </Badge>
                          <div className="flex items-center gap-3">
                            {sale.status !== "Canceled" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
                                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancel Entire Sale
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="glass-card border-white/10">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Transaction?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will mark the entire sale as canceled and restore <strong>all items</strong> back to the inventory. This action is only allowed if the day hasn't been settled.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-white/5 border-white/10">No, Keep</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleCancelSale(sale)} className="bg-destructive text-destructive-foreground">
                                      Yes, Cancel & Restore Stock
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'PPP p') : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
          <CardContent className="border-t border-white/5 p-4">
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {paginatedSales.length} of {filteredSales.length} sales
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-10 px-4 rounded-xl border-white/10"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1 text-sm font-bold px-4 bg-primary/10 rounded-xl text-primary">
                    {currentPage} / {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-10 px-4 rounded-xl border-white/10"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
