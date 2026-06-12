"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  MinusCircle,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  User,
  History as HistoryIcon
} from "lucide-react";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, increment, serverTimestamp, getDoc, where, limit } from "firebase/firestore";
import { cn, formatNigeriaTime } from "@/lib/utils";
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
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const ITEMS_PER_PAGE = 13;

export default function SalesAuditPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"shift" | "all">("shift");
  
  // 1. Get User Profile for Role
  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userRecord } = useDoc(userRef);
  const isAdmin = userRecord?.role === 'admin';

  // 2. Get Active Shift
  // For staff: their own active shift
  // For admin: any active shift (latest one)
  const activeShiftQuery = useMemo(() => {
    if (!firestore || !userRecord) return null;
    
    const baseQuery = collection(firestore, "shifts");
    if (isAdmin) {
      // Admins see performance of whoever is currently active
      return query(baseQuery, where("status", "==", "active"), orderBy("startTime", "desc"), limit(1));
    }
    // Staff only see their own active session
    return query(
      baseQuery,
      where("staffId", "==", user?.uid),
      where("status", "==", "active"),
      limit(1)
    );
  }, [firestore, user, isAdmin, userRecord]);

  const { data: activeShifts, loading: shiftStatusLoading } = useCollection(activeShiftQuery);
  const activeShift = activeShifts?.[0];

  // 3. Fetch Sales
  const salesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "sales"), orderBy("timestamp", "desc"));
  }, [firestore]);

  const { data: allSales, loading } = useCollection(salesQuery);

  // 4. Filter Sales based on View Mode
  const filteredSales = useMemo(() => {
    if (!allSales) return [];
    return allSales.filter(sale => {
      // Primary View Filter
      if (viewMode === "shift") {
        if (!activeShift) return false;
        if (sale.shiftId !== activeShift.id) return false;
      }

      // Search Filter (Strictly applied to aggregations later)
      const searchMatch = 
        !search ||
        sale.tableNumber?.toLowerCase().includes(search.toLowerCase()) || 
        sale.method?.toLowerCase().includes(search.toLowerCase()) ||
        sale.items?.some((i: any) => i.name?.toLowerCase().includes(search.toLowerCase()));

      return searchMatch;
    });
  }, [allSales, viewMode, activeShift, search]);

  // 5. Aggregate Metrics (Strict item filtering if search is active)
  const reportMetrics = useMemo(() => {
    const isSearching = search.trim().length > 0;
    
    // We only want to sum items that match the search if searching
    // Otherwise we sum the whole transaction total
    let totalRevenue = 0;
    let settledRevenue = 0;
    let unsettledRevenue = 0;
    let activeCount = 0;
    let settledCount = 0;
    let unsettledCount = 0;

    filteredSales.forEach(sale => {
      if (sale.status === "Canceled") return;
      
      activeCount++;
      if (sale.status === "Completed") settledCount++;
      if (sale.status === "Unsettled") unsettledCount++;

      if (isSearching) {
        // Only sum items matching search in the receipt
        const matchingItemsTotal = sale.items
          ?.filter((i: any) => i.name?.toLowerCase().includes(search.toLowerCase()))
          .reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) || 0;
        
        totalRevenue += matchingItemsTotal;
        if (sale.status === "Completed") settledRevenue += matchingItemsTotal;
        if (sale.status === "Unsettled") unsettledRevenue += matchingItemsTotal;
      } else {
        // Sum the full transaction
        const saleTotal = sale.total || 0;
        totalRevenue += saleTotal;
        if (sale.status === "Completed") settledRevenue += saleTotal;
        if (sale.status === "Unsettled") unsettledRevenue += saleTotal;
      }
    });

    return {
      totalRevenue,
      settledRevenue,
      unsettledRevenue,
      count: activeCount,
      settledCount,
      unsettledCount,
    };
  }, [filteredSales, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

  const checkShiftStatus = (shiftId: string): Promise<boolean> => {
    if (shiftId === "admin-override") return Promise.resolve(false);
    if (!firestore || !shiftId) return Promise.resolve(true);
    const shiftRef = doc(firestore, "shifts", shiftId);
    return getDoc(shiftRef).then(shiftSnap => {
      if (!shiftSnap.exists()) return true;
      return shiftSnap.data().status !== "active";
    });
  };

  const handleSettleSale = (sale: any, method: string) => {
    if (!firestore) return;

    checkShiftStatus(sale.shiftId).then(isClosed => {
      if (isClosed && !isAdmin) {
        toast({
          variant: "destructive",
          title: "Action Restricted",
          description: `This transaction belongs to a closed shift and cannot be modified.`,
        });
        return;
      }

      const saleRef = doc(firestore, "sales", sale.id);
      const updateData = {
        status: "Completed",
        method: method,
        settledAt: serverTimestamp()
      };

      updateDoc(saleRef, updateData)
        .then(() => {
          toast({ title: "Sale Settled", description: `Transaction recorded via ${method}.` });
        })
        .catch((error) => {
          errorEmitter.emit("permission-error", new FirestorePermissionError({
            path: saleRef.path,
            operation: "update",
            requestResourceData: updateData
          }));
        });
    });
  };

  const handleCancelSale = (sale: any) => {
    if (!firestore) return;

    checkShiftStatus(sale.shiftId).then(isClosed => {
      if (isClosed && !isAdmin) {
        toast({
          variant: "destructive",
          title: "Action Restricted",
          description: `This transaction belongs to a closed shift and cannot be canceled.`,
        });
        return;
      }

      const saleRef = doc(firestore, "sales", sale.id);
      const saleData = {
        status: "Canceled",
        canceledAt: serverTimestamp()
      };

      updateDoc(saleRef, saleData).catch((error) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: saleRef.path,
          operation: "update",
          requestResourceData: saleData
        }));
      });

      for (const item of sale.items) {
        const stockRef = doc(firestore, "inventory", item.itemId);
        updateDoc(stockRef, {
          stock: increment(item.quantity),
          lastUpdated: serverTimestamp()
        }).catch(() => {});
      }

      toast({
        title: "Sale Canceled",
        description: `Inventory restored and transaction marked as canceled.`,
      });
    });
  };

  const handleVoidItem = (sale: any, itemIndex: number) => {
    if (!firestore) return;

    checkShiftStatus(sale.shiftId).then(isClosed => {
      if (isClosed && !isAdmin) {
        toast({
          variant: "destructive",
          title: "Action Restricted",
          description: `This transaction belongs to a closed shift and cannot be edited.`,
        });
        return;
      }

      const itemToVoid = sale.items[itemIndex];
      const updatedItems = sale.items.filter((_: any, i: number) => i !== itemIndex);
      const updatedTotal = updatedItems.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
      const saleRef = doc(firestore, "sales", sale.id);

      let saleUpdate: any;
      if (updatedItems.length === 0) {
        saleUpdate = {
          status: "Canceled",
          canceledAt: serverTimestamp(),
          items: [],
          total: 0
        };
      } else {
        saleUpdate = {
          items: updatedItems,
          total: updatedTotal
        };
      }

      updateDoc(saleRef, saleUpdate).catch((error) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: saleRef.path,
          operation: "update",
          requestResourceData: saleUpdate
        }));
      });

      const stockRef = doc(firestore, "inventory", itemToVoid.itemId);
      updateDoc(stockRef, {
        stock: increment(itemToVoid.quantity),
        lastUpdated: serverTimestamp()
      }).catch(() => {});

      toast({
        title: "Item Voided",
        description: `${itemToVoid.name} removed and stock restored.`,
      });
    });
  };

  const printShiftSummary = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !activeShift) return;

    const shiftStart = activeShift.startTime?.toDate ? formatNigeriaTime(activeShift.startTime.toDate()) : "OFFLINE - NO DATE";
    const isSearching = search.trim().length > 0;
    
    const itemTotals: Record<string, { qty: number; revenue: number }> = {};
    filteredSales.filter(s => s.status !== "Canceled").forEach(sale => {
      sale.items?.forEach((item: any) => {
        // If searching, only include items that match the search
        if (isSearching && !item.name?.toLowerCase().includes(search.toLowerCase())) return;
        
        if (!itemTotals[item.name]) {
          itemTotals[item.name] = { qty: 0, revenue: 0 };
        }
        itemTotals[item.name].qty += item.quantity;
        itemTotals[item.name].revenue += (item.price * item.quantity);
      });
    });

    const itemsHtml = Object.entries(itemTotals)
      .sort((a, b) => b[1].qty - a[1].qty)
      .map(([name, data]) => `
        <tr style="border-bottom: 1px dashed #000;">
          <td style="padding: 6px 0;">${name}</td>
          <td style="padding: 6px 0; text-align: center;">${data.qty}</td>
          <td style="padding: 6px 0; text-align: right;">₦${data.revenue.toLocaleString()}</td>
        </tr>
      `).join('');

    const html = `
      <html>
        <head>
          <title>Shift Summary - ${activeShift.staffName}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: 'Arial', sans-serif; width: 80mm; padding: 5mm; color: #000; font-size: 11px; line-height: 1.3; margin: 0 auto; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
            .header h1 { font-size: 16px; margin: 0; text-transform: uppercase; }
            .header p { font-size: 10px; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; border-bottom: 1px solid #000; padding: 4px 0; font-size: 9px; text-transform: uppercase; }
            .total-section { margin-top: 15px; border-top: 2px solid #000; padding-top: 8px; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NIGHTINGALE HOTEL</h1>
            <p class="bold">SHIFT SUMMARY REPORT</p>
            <p>STAFF: ${activeShift.staffName.toUpperCase()}</p>
            <p>STARTED: ${shiftStart}</p>
            ${isSearching ? `<p class="bold">FILTER: ${search.toUpperCase()}</p>` : ''}
          </div>
          
          <table style="margin-bottom: 15px;">
            <thead>
              <tr>
                <th>Item Sold</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row" style="color: #666; font-size: 10px;">
              <span>SETTLED REVENUE:</span>
              <span>₦${reportMetrics.settledRevenue.toLocaleString()}</span>
            </div>
            <div class="total-row" style="color: #666; font-size: 10px;">
              <span>PENDING (UNSETTLED):</span>
              <span>₦${reportMetrics.unsettledRevenue.toLocaleString()}</span>
            </div>
            <div class="total-row" style="margin-top: 8px; font-size: 14px; border-top: 1px solid #000; padding-top: 4px;">
              <span>TOTAL SALES:</span>
              <span>₦${reportMetrics.totalRevenue.toLocaleString()}</span>
            </div>
          </div>

          <div class="center" style="margin-top: 20px; font-size: 8px;">
            GENERATED: ${formatNigeriaTime(new Date(), true)}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const printDucket = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = sale.timestamp?.toDate ? formatNigeriaTime(sale.timestamp.toDate()) : "OFFLINE - NO DATE";
    
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
            body { font-family: 'Arial', sans-serif; width: 80mm; padding: 10mm; font-size: 14px; color: #000; line-height: 1.4; }
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
          <div class="meta">STAFF: ${sale.staffName}</div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="total" style="display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>₦${sale.total.toLocaleString()}</span>
          </div>
          <div class="meta" style="margin-top: 8px; font-size: 16px;">PAYMENT: ${sale.method.toUpperCase()}</div>
          <div class="divider"></div>
          <div class="center bold" style="margin-top: 15px; font-size: 16px;">
            ${sale.status === 'Canceled' ? '*** VOID ***' : sale.status === 'Unsettled' ? '*** UNSETTLED ***' : '*** DUPLICATE ***'}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Card': return <CreditCard className="w-3 h-3" />;
      case 'Cash': return <Banknote className="w-3 h-3" />;
      case 'Transfer': return <ArrowLeftRight className="w-3 h-3" />;
      case 'Unsettled': return <AlertCircle className="w-3 h-3 text-amber-500" />;
      default: return null;
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-headline font-bold uppercase tracking-tight">Sales Audit</h1>
            <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-primary" /> Shift-Based Accountability (WAT)
            </p>
          </div>
          <div className="flex gap-2">
            {viewMode === "shift" && activeShift && (
              <Button variant="outline" size="sm" className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" onClick={printShiftSummary}>
                <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print Shift Report</span><span className="sm:hidden">Summary</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2 border-white/10" asChild>
              <Link href="/bar/sales">
                <ShoppingCart className="w-4 h-4" /> <span className="hidden sm:inline">New Sale</span><span className="sm:hidden">POS</span>
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full">
          <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
            <TabsTrigger value="shift" className="gap-2 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="w-4 h-4" /> 
              {isAdmin ? "Active Session Performance" : "Current Shift"}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="all" className="gap-2 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <HistoryIcon className="w-4 h-4" /> Global History
              </TabsTrigger>
            )}
          </TabsList>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            <Card className="glass-card">
              <CardContent className="pt-4 md:pt-6">
                <div className="text-[9px] md:text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none mb-2 flex items-center gap-1.5 md:gap-2">
                  <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3" /> Settled
                </div>
                <div className="text-xl md:text-2xl font-bold font-headline text-white truncate">
                  ₦{reportMetrics.settledRevenue.toLocaleString()}
                </div>
                <p className="text-[8px] md:text-[10px] text-muted-foreground mt-1">{reportMetrics.settledCount} Rec</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-l-2 md:border-l-4 border-l-amber-500">
              <CardContent className="pt-4 md:pt-6">
                <div className="text-[9px] md:text-[10px] font-bold text-amber-500 uppercase tracking-widest leading-none mb-2 flex items-center gap-1.5 md:gap-2">
                  <AlertCircle className="w-2.5 h-2.5 md:w-3 md:h-3" /> Pending
                </div>
                <div className="text-xl md:text-2xl font-bold font-headline text-white truncate">
                  ₦{reportMetrics.unsettledRevenue.toLocaleString()}
                </div>
                <p className="text-[8px] md:text-[10px] text-muted-foreground mt-1">{reportMetrics.unsettledCount} Rec</p>
              </CardContent>
            </Card>
            <Card className="glass-card md:col-span-2 border-l-2 md:border-l-4 border-l-primary">
              <CardContent className="pt-4 md:pt-6">
                <div className="text-[9px] md:text-[10px] font-bold text-primary uppercase tracking-widest leading-none mb-2">Total Period Revenue</div>
                <div className="text-xl md:text-2xl font-bold font-headline text-white">₦{reportMetrics.totalRevenue.toLocaleString()}</div>
                <p className="text-[8px] md:text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest">
                  {viewMode === "shift" 
                    ? (activeShift ? `Active: ${activeShift.staffName}` : "No Session Active") 
                    : "Global Audit Mode"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="border-b border-white/5 pb-4 px-4 md:px-6">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <CardTitle className="text-lg md:text-xl font-headline flex items-center gap-2">
                  <FileText className="text-primary w-4 h-4 md:w-5 md:h-5" /> 
                  {viewMode === "shift" 
                    ? (activeShift ? `Live Performance: ${activeShift.staffName}` : "Shift Activity Log") 
                    : "Global Sales Archive"}
                </CardTitle>
                
                <div className="relative w-full sm:w-64 lg:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search receipt, item, point..." 
                    className="pl-10 h-10 bg-white/5 border-white/10 rounded-xl text-sm" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading || shiftStatusLoading ? (
                <div className="py-20 text-center animate-pulse text-muted-foreground text-sm uppercase font-bold tracking-widest">Auditing records...</div>
              ) : filteredSales.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-4 text-muted-foreground opacity-40">
                  <BarChart3 className="w-10 h-10 md:w-12 md:h-12" />
                  <p className="italic text-sm">
                    {viewMode === "shift" && !activeShift 
                      ? "No staff session is currently active." 
                      : "No transactions found for this audit scope."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {paginatedSales.map((sale) => {
                    const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : null;
                    return (
                      <Collapsible key={sale.id} className="group">
                        <div className={cn(
                          "p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer",
                          sale.status === "Canceled" && "opacity-60 bg-red-500/[0.02]",
                          sale.status === "Unsettled" && "bg-amber-500/[0.03]"
                        )}>
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-3 md:gap-4 items-center">
                            <div className="flex flex-col">
                              <span className="text-[8px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Receipt</span>
                              <div className="flex wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] md:text-xs font-bold text-white">#{sale.id.slice(-8).toUpperCase()}</span>
                                {sale.status === "Canceled" ? (
                                  <Badge variant="destructive" className="h-3.5 text-[7px] md:text-[8px] uppercase px-1">Void</Badge>
                                ) : sale.status === "Unsettled" ? (
                                  <Badge variant="outline" className="h-3.5 text-[7px] md:text-[8px] uppercase px-1 border-amber-500/50 text-amber-500">Pending</Badge>
                                ) : (
                                  <Badge variant="outline" className="h-3.5 text-[7px] md:text-[8px] uppercase px-1 border-emerald-500/50 text-emerald-500">Paid</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Date & Time</span>
                              {saleDate ? (
                                <span className="text-[10px] md:text-sm font-medium truncate">
                                  {formatNigeriaTime(saleDate)}
                                </span>
                              ) : (
                                <span className="text-[10px] md:text-xs font-bold text-primary/50 animate-pulse flex items-center gap-1">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> SYNCING...
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Staff / Point</span>
                              <div className="flex flex-col leading-tight">
                                <span className="text-[10px] md:text-sm font-medium text-primary truncate">{sale.tableNumber}</span>
                                <span className="text-[8px] text-muted-foreground uppercase font-bold truncate">{sale.staffName}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end md:items-start">
                              <span className="text-[8px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Grand Total</span>
                              <span className={cn(
                                "text-sm md:text-lg font-headline font-bold text-white",
                                sale.status === "Canceled" && "line-through text-muted-foreground"
                              )}>₦{sale.total.toLocaleString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 md:gap-2 ml-4 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); printDucket(sale); }}>
                              <Printer className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </Button>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10">
                                <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 transition-transform group-data-[state=open]:rotate-180" />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        
                        <CollapsibleContent className="bg-white/[0.02] px-4 md:px-6 py-4 border-t border-white/5">
                          <div className="max-w-md space-y-6">
                            {sale.status === "Unsettled" && (
                              <div className="p-3 md:p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-4">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                                  <span className="text-[10px] md:text-xs font-bold text-amber-500 uppercase tracking-widest">Finalize Payment</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <Button size="sm" className="bg-primary text-primary-foreground font-bold h-9 md:h-10 text-[10px] md:text-sm px-1" onClick={() => handleSettleSale(sale, "Card")}>
                                    <CreditCard className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" /> Card
                                  </Button>
                                  <Button size="sm" variant="outline" className="border-primary/30 text-primary font-bold h-9 md:h-10 text-[10px] md:text-sm px-1" onClick={() => handleSettleSale(sale, "Transfer")}>
                                    <ArrowLeftRight className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" /> Trans
                                  </Button>
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 md:h-10 text-[10px] md:text-sm px-1" onClick={() => handleSettleSale(sale, "Cash")}>
                                    <Banknote className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" /> Cash
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-[0.1em] md:tracking-[0.2em] border-b border-white/10 pb-2">
                                <span>Items</span>
                                <span>Total</span>
                              </div>
                              {sale.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-[11px] md:text-sm group/item">
                                  <span className="text-white/80">
                                    {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                                    {(sale.status !== "Canceled" && (isAdmin || sale.shiftId === activeShift?.id)) && (
                                      <button 
                                        onClick={() => handleVoidItem(sale, idx)}
                                        className="ml-2 text-destructive opacity-40 hover:opacity-100 transition-opacity"
                                        title="Void this item"
                                      >
                                        <MinusCircle className="w-3 h-3 md:w-3.5 md:h-3.5 inline" />
                                      </button>
                                    )}
                                  </span>
                                  <span className="font-headline font-bold">₦{(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                            
                            <div className="pt-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-t border-white/5">
                              <Badge variant="outline" className="gap-1.5 border-white/10 text-[9px] md:text-[10px] uppercase font-bold py-1 w-fit">
                                {getMethodIcon(sale.method)} {sale.method}
                              </Badge>
                              <div className="flex items-center justify-between sm:justify-end gap-3">
                                {sale.status !== "Canceled" && (isAdmin || sale.shiftId === activeShift?.id) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 text-[10px] md:text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-2">
                                        <XCircle className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1.5" /> Void Sale
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="glass-card border-white/10 mx-4 w-[calc(100%-2rem)] max-w-lg">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Void Transaction?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will mark the entire sale as canceled and restore <strong>all items</strong> back to the inventory.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel className="bg-white/5 border-white/10 mt-0">No, Keep</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleCancelSale(sale)} className="bg-destructive text-destructive-foreground">
                                          Yes, Void & Restore Stock
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                                <span className="text-[10px] md:text-xs text-muted-foreground shrink-0 uppercase font-bold tracking-widest">
                                  Shift ID: #{sale.shiftId?.slice(-6).toUpperCase() || 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
            <CardContent className="border-t border-white/5 p-4">
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-[10px] md:text-xs text-muted-foreground uppercase font-bold tracking-widest">
                    Showing {paginatedSales.length} Records
                  </p>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-10 px-4 rounded-xl border-white/10 flex-1 sm:flex-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center justify-center gap-1 text-sm font-bold px-4 bg-primary/10 rounded-xl text-primary flex-1 sm:flex-none">
                      {currentPage} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-10 px-4 rounded-xl border-white/10 flex-1 sm:flex-none"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </AppShell>
  );
}
