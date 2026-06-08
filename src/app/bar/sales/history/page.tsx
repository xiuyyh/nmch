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
import { Label } from "@/components/ui/label";
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
  History as HistoryIcon,
  MinusCircle,
  Calendar as CalendarIcon,
  Download,
  Filter,
  BarChart3
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, increment, serverTimestamp, getDoc } from "firebase/firestore";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
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
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const ITEMS_PER_PAGE = 10;

export default function SalesHistoryPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Manual Date State
  const [dateFrom, setDateFrom] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const salesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "sales"), orderBy("timestamp", "desc"));
  }, [firestore]);

  const { data: sales, loading } = useCollection(salesQuery);

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter(sale => {
      const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : null;
      
      // Manual Date Range Filter
      if (dateFrom && dateTo && saleDate) {
        try {
          const start = startOfDay(parseISO(dateFrom));
          const end = endOfDay(parseISO(dateTo));
          if (!isWithinInterval(saleDate, { start, end })) {
            return false;
          }
        } catch (e) {
          // If parsing fails, don't filter by date
        }
      }

      // Search Filter
      const searchMatch = 
        sale.tableNumber?.toLowerCase().includes(search.toLowerCase()) || 
        sale.method?.toLowerCase().includes(search.toLowerCase()) ||
        sale.items?.some((i: any) => i.name?.toLowerCase().includes(search.toLowerCase()));

      return searchMatch;
    });
  }, [sales, search, dateFrom, dateTo]);

  // Aggregated Report Metrics
  const reportMetrics = useMemo(() => {
    const activeSales = filteredSales.filter(s => s.status !== "Canceled");
    let totalItemQty = 0;
    let totalItemRevenue = 0;
    const isSearchingItem = search.length > 2;

    activeSales.forEach(sale => {
      sale.items?.forEach((item: any) => {
        if (!isSearchingItem || item.name.toLowerCase().includes(search.toLowerCase())) {
          totalItemQty += item.quantity;
          totalItemRevenue += (item.price * item.quantity);
        }
      });
    });

    return {
      totalRevenue: activeSales.reduce((sum, s) => sum + (s.total || 0), 0),
      count: activeSales.length,
      itemQty: totalItemQty,
      itemRevenue: totalItemRevenue,
      isSearchingItem
    };
  }, [filteredSales, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

  const checkSettlement = async (timestamp: any) => {
    if (!firestore || !timestamp) return false;
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

    const saleRef = doc(firestore, "sales", sale.id);
    const saleData = {
      status: "Canceled",
      canceledAt: serverTimestamp()
    };

    updateDoc(saleRef, saleData).catch(async (error) => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: saleRef.path,
        operation: "update",
        requestResourceData: saleData
      }));
    });

    // Restock all items
    for (const item of sale.items) {
      const stockRef = doc(firestore, "inventory", item.itemId);
      const stockUpdate = {
        stock: increment(item.quantity),
        lastUpdated: serverTimestamp()
      };
      
      updateDoc(stockRef, stockUpdate).catch(async (error) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: stockRef.path,
          operation: "update",
          requestResourceData: stockUpdate
        }));
      });
    }

    toast({
      title: "Sale Canceled",
      description: `Inventory restored and transaction marked as canceled.`,
    });
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

    updateDoc(saleRef, saleUpdate).catch(async (error) => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: saleRef.path,
        operation: "update",
        requestResourceData: saleUpdate
      }));
    });

    // Restock the specific item
    const stockRef = doc(firestore, "inventory", itemToVoid.itemId);
    const stockUpdate = {
      stock: increment(itemToVoid.quantity),
      lastUpdated: serverTimestamp()
    };

    updateDoc(stockRef, stockUpdate).catch(async (error) => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: stockRef.path,
        operation: "update",
        requestResourceData: stockUpdate
      }));
    });

    toast({
      title: "Item Voided",
      description: `${itemToVoid.name} removed and stock restored.`,
    });
  };

  const printSalesReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const fromDate = dateFrom ? format(parseISO(dateFrom), "PPP") : "N/A";
    const toDate = dateTo ? format(parseISO(dateTo), "PPP") : "N/A";
    
    const itemsHtml = paginatedSales.map((sale: any) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px 0;">${sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'dd/MM/yy HH:mm') : 'N/A'}</td>
        <td style="padding: 8px 0;">${sale.tableNumber}</td>
        <td style="padding: 8px 0;">${sale.items?.map((i:any) => i.name + ' x' + i.quantity).join(', ')}</td>
        <td style="padding: 8px 0; text-align: right;">₦${sale.total.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Sales Report: ${fromDate} - ${toDate}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
            .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .metric-box { padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
            .metric-label { font-size: 12px; color: #666; text-transform: uppercase; font-weight: bold; }
            .metric-value { font-size: 24px; font-weight: bold; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 2px solid #333; padding: 10px 0; font-size: 13px; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NIGHTINGALE HOTEL</h1>
            <h2>Sales Audit Report</h2>
            <p>Period: ${fromDate} to ${toDate}</p>
            ${search ? `<p>Filter: "${search}"</p>` : ''}
          </div>
          
          <div class="metrics">
            <div class="metric-box">
              <div class="metric-label">Total Period Revenue</div>
              <div class="metric-value">₦${reportMetrics.totalRevenue.toLocaleString()}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Transactions</div>
              <div class="metric-value">${reportMetrics.count}</div>
            </div>
            ${reportMetrics.isSearchingItem ? `
              <div class="metric-box">
                <div class="metric-label">Qty of "${search}"</div>
                <div class="metric-value">${reportMetrics.itemQty}</div>
              </div>
              <div class="metric-box">
                <div class="metric-label">Revenue from "${search}"</div>
                <div class="metric-value">₦${reportMetrics.itemRevenue.toLocaleString()}</div>
              </div>
            ` : ''}
          </div>

          <h3>Transaction Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Table</th>
                <th>Items</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="footer">
            Report generated on ${format(new Date(), "PPP p")} by NMCH POS
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
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
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Sales Audit & Reports</h1>
            <p className="text-muted-foreground">Detailed history with advanced item and date filtering.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-white/10" onClick={printSalesReport}>
              <Printer className="w-4 h-4" /> Print Report
            </Button>
            <Button variant="outline" className="gap-2 border-white/10" asChild>
              <Link href="/bar/sales">
                <ShoppingCart className="w-4 h-4" /> New Sale
              </Link>
            </Button>
          </div>
        </div>

        {/* Reporting Mode Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-2">Period Revenue</div>
              <div className="text-2xl font-bold font-headline text-primary">
                ₦{reportMetrics.totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-2">Transactions</div>
              <div className="text-2xl font-bold font-headline">{reportMetrics.count}</div>
            </CardContent>
          </Card>
          
          {reportMetrics.isSearchingItem ? (
            <>
              <Card className="glass-card border-l-4 border-l-primary animate-in fade-in slide-in-from-right-4">
                <CardContent className="pt-6">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none mb-2">"{search}" Qty</div>
                  <div className="text-2xl font-bold font-headline text-white">{reportMetrics.itemQty}</div>
                </CardContent>
              </Card>
              <Card className="glass-card border-l-4 border-l-primary animate-in fade-in slide-in-from-right-4">
                <CardContent className="pt-6">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none mb-2">"{search}" Value</div>
                  <div className="text-2xl font-bold font-headline text-white">₦{reportMetrics.itemRevenue.toLocaleString()}</div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="md:col-span-2 p-6 flex items-center justify-center bg-white/5 rounded-xl border border-dashed border-white/10">
              <p className="text-xs text-muted-foreground italic flex items-center gap-2">
                <Search className="w-3 h-3" /> Type an item name to see specific sales analytics
              </p>
            </div>
          )}
        </div>

        <Card className="glass-card">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <FileText className="text-primary w-5 h-5" /> Detailed Logs
              </CardTitle>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                {/* Manual Date Input Range */}
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-xl w-full sm:w-auto h-10">
                  <div className="flex flex-col">
                    <Label className="text-[8px] font-bold text-primary/50 uppercase leading-none mb-0.5">From</Label>
                    <input 
                      type="date" 
                      className="bg-transparent border-none text-xs font-bold text-white outline-none w-28 [color-scheme:dark]" 
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div className="flex flex-col">
                    <Label className="text-[8px] font-bold text-primary/50 uppercase leading-none mb-0.5">To</Label>
                    <input 
                      type="date" 
                      className="bg-transparent border-none text-xs font-bold text-white outline-none w-28 [color-scheme:dark]" 
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search table, item, or method..." 
                    className="pl-10 h-10 bg-white/5 border-white/10 rounded-xl" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center animate-pulse text-muted-foreground">Fetching records...</div>
            ) : filteredSales.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4 text-muted-foreground opacity-40">
                <BarChart3 className="w-12 h-12" />
                <p className="italic">No transactions found for the selected criteria.</p>
              </div>
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
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Date & Time</span>
                          <span className="text-sm font-medium">
                            {sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'dd/MM/yy HH:mm') : 'N/A'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Service Point</span>
                          <span className="text-sm font-medium text-primary">{sale.tableNumber}</span>
                        </div>
                        <div className="flex flex-col items-end md:items-start">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Grand Total</span>
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
                            <span>Itemized List</span>
                            <span>Line Total</span>
                          </div>
                          {sale.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm group/item">
                              <span className={cn(
                                "text-white/80",
                                search && item.name.toLowerCase().includes(search.toLowerCase()) && "text-primary font-bold"
                              )}>
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
                                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> Void Entire Sale
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="glass-card border-white/10">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Void Transaction?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will mark the entire sale as canceled and restore <strong>all items</strong> back to the inventory. This action is only allowed if the day hasn't been settled.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-white/5 border-white/10">No, Keep</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleCancelSale(sale)} className="bg-destructive text-destructive-foreground">
                                      Yes, Void & Restore Stock
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
                  Showing {paginatedSales.length} of {filteredSales.length} transactions
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
