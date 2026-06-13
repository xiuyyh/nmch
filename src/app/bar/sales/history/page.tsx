
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
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
  MinusCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  User,
  History as HistoryIcon,
  ChevronRightSquare,
  EyeOff,
  PlusCircle,
  Trash2,
  Receipt
} from "lucide-react";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, increment, serverTimestamp, getDoc, where, limit, addDoc } from "firebase/firestore";
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

const SHIFTS_PER_PAGE = 10;

export default function SalesAuditPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"shift" | "all">("shift");
  const [hideVoided, setHideVoided] = useState(false);
  
  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userRecord } = useDoc(userRef);
  const isAdmin = userRecord?.role === 'admin';

  // 1. Get Live Data for Active Session
  const liveShiftQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "shifts"), where("status", "==", "active"), limit(5));
  }, [firestore]);
  const { data: allActiveShifts } = useCollection(liveShiftQuery);

  const activeShift = useMemo(() => {
    if (!allActiveShifts) return null;
    if (isAdmin) return allActiveShifts[0]; // Admins see globally active
    return allActiveShifts.find(s => s.staffId === user?.uid);
  }, [allActiveShifts, isAdmin, user]);

  // 2. Get Global Shifts for Paginated History
  const historyShiftsQuery = useMemo(() => {
    if (!firestore || viewMode !== "all") return null;
    return query(collection(firestore, "shifts"), orderBy("startTime", "desc"), limit(200));
  }, [firestore, viewMode]);
  const { data: historyShifts, loading: shiftsLoading } = useCollection(historyShiftsQuery);

  // 3. Get Sales (All recent sales to group)
  const salesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "sales"), orderBy("timestamp", "desc"), limit(1000));
  }, [firestore]);
  const { data: allSales, loading: salesLoading } = useCollection(salesQuery);

  // Group sales by Shift ID
  const groupedSales = useMemo(() => {
    if (!allSales) return {};
    const groups: Record<string, any[]> = {};
    allSales.forEach(sale => {
      if (hideVoided && sale.status === "Canceled") return;
      if (!groups[sale.shiftId]) groups[sale.shiftId] = [];
      groups[sale.shiftId].push(sale);
    });
    return groups;
  }, [allSales, hideVoided]);

  const filteredHistoryShifts = useMemo(() => {
    if (!historyShifts) return [];
    return historyShifts.filter(s => {
      // Hide if marked as hidden in database
      if (s.hidden) return false;
      
      if (!search) return true;
      const sales = groupedSales[s.id] || [];
      return (
        s.staffName?.toLowerCase().includes(search.toLowerCase()) ||
        sales.some(sale => 
          sale.id.toLowerCase().includes(search.toLowerCase()) ||
          sale.tableNumber?.toLowerCase().includes(search.toLowerCase())
        )
      );
    });
  }, [historyShifts, search, groupedSales]);

  const totalPages = Math.max(1, Math.ceil(filteredHistoryShifts.length / SHIFTS_PER_PAGE));
  const paginatedShifts = useMemo(() => {
    const start = (currentPage - 1) * SHIFTS_PER_PAGE;
    return filteredHistoryShifts.slice(start, start + SHIFTS_PER_PAGE);
  }, [filteredHistoryShifts, currentPage]);

  const handleSettleSale = (sale: any, method: string) => {
    if (!firestore) return;
    const saleRef = doc(firestore, "sales", sale.id);
    const updateData = { status: "Completed", method: method, settledAt: serverTimestamp() };
    updateDoc(saleRef, updateData).then(() => {
      toast({ title: "Sale Settled", description: `Transaction recorded via ${method}.` });
    }).catch((error) => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: saleRef.path, operation: "update", requestResourceData: updateData }));
    });
  };

  const handleCancelSale = (sale: any) => {
    if (!firestore) return;
    const saleRef = doc(firestore, "sales", sale.id);
    const saleData = { status: "Canceled", canceledAt: serverTimestamp() };
    updateDoc(saleRef, saleData).then(() => {
      for (const item of sale.items) {
        const stockRef = doc(firestore, "inventory", item.itemId);
        updateDoc(stockRef, { stock: increment(item.quantity), lastUpdated: serverTimestamp() }).catch(() => {});
      }
      toast({ title: "Sale Canceled", description: `Inventory restored.` });
    });
  };

  const handleHideShift = (shift: any) => {
    if (!firestore || !isAdmin) return;
    const shiftRef = doc(firestore, "shifts", shift.id);
    updateDoc(shiftRef, { hidden: true })
      .then(() => {
        addDoc(collection(firestore, "adminActions"), {
          adminName: userRecord?.displayName || user?.email,
          adminId: user?.uid,
          action: "HIDE_SHIFT",
          entity: "AUDIT",
          details: JSON.stringify({ 
            shiftId: shift.id, 
            staffName: shift.staffName,
            startTime: shift.startTime?.toDate ? formatNigeriaTime(shift.startTime.toDate()) : "N/A"
          }),
          timestamp: serverTimestamp()
        }).catch(() => {});
        toast({ title: "Shift Hidden", description: "Record removed from global audit. Can be unhidden in Admin Actions." });
      });
  };

  const printShiftSummary = (shift: any) => {
    const sales = groupedSales[shift.id] || [];
    const validSales = sales.filter(s => s.status !== "Canceled");
    
    // Aggregate items
    const itemMap: Record<string, number> = {};
    validSales.forEach(s => {
      s.items?.forEach((i: any) => {
        itemMap[i.name] = (itemMap[i.name] || 0) + i.quantity;
      });
    });

    const totalRev = validSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const settledRev = validSales.filter(s => s.status === "Completed").reduce((sum, s) => sum + (s.total || 0), 0);
    const pendingRev = validSales.filter(s => s.status === "Unsettled").reduce((sum, s) => sum + (s.total || 0), 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = Object.entries(itemMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:700;"><span>${name}</span><span>x${qty}</span></div>`)
      .join('');

    const html = `
      <html>
        <head><title>Shift Audit</title><style>@page { size: 80mm auto; margin: 0; } body { font-family: sans-serif; width: 80mm; padding: 10mm; font-size: 14px; color: #000; }</style></head>
        <body>
          <div style="text-align:center; font-size:22px; font-weight:900;">NIGHTINGALE HOTEL</div>
          <div style="text-align:center; font-size:16px; margin-bottom:10px;">SHIFT PERFORMANCE AUDIT</div>
          <div style="border-bottom:2px solid #000; margin:10px 0;"></div>
          <div style="font-weight:700;">STAFF: ${shift.staffName.toUpperCase()}</div>
          <div style="font-weight:700;">STARTED: ${shift.startTime?.toDate ? formatNigeriaTime(shift.startTime.toDate()) : 'N/A'}</div>
          <div style="border-bottom:1px solid #000; margin:10px 0;"></div>
          <div style="font-size:12px; font-weight:900; margin-bottom:8px; text-transform:uppercase;">Itemized Deductions:</div>
          ${itemsHtml}
          <div style="border-top:2px solid #000; margin-top:15px; padding-top:10px;">
            <div style="display:flex; justify-content:space-between; font-weight:700;"><span>SETTLED:</span><span>₦${settledRev.toLocaleString()}</span></div>
            <div style="display:flex; justify-content:space-between; font-weight:700; color:#555;"><span>PENDING:</span><span>₦${pendingRev.toLocaleString()}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:20px; font-weight:900; margin-top:8px;"><span>TOTAL:</span><span>₦${totalRev.toLocaleString()}</span></div>
          </div>
          <div style="text-align:center; font-weight:900; margin-top:20px; font-size:10px;">*** END OF SHIFT SUMMARY ***</div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const printDucket = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateStr = sale.timestamp?.toDate ? formatNigeriaTime(sale.timestamp.toDate()) : "OFFLINE - NO DATE";
    const itemsHtml = sale.items.map((item: any) => `<div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 800; font-size: 16px;"><span>${item.name} x ${item.quantity}</span><span>₦${(item.price * item.quantity).toLocaleString()}</span></div>`).join('');
    const html = `<html><head><title>Ducket</title><style>@page { size: 80mm auto; margin: 0; } body { font-family: sans-serif; width: 80mm; padding: 10mm; font-size: 14px; color: #000; }</style></head><body><div style="text-align:center; font-size:24px; font-weight:900;">NIGHTINGALE HOTEL</div><div style="text-align:center; font-size:18px;">Duplicate Ducket</div><div style="border-bottom:2px solid #000; margin:10px 0;"></div><div style="font-weight:700;">DATE: ${dateStr}</div><div style="font-weight:700;">REC#: ${sale.id.slice(-8).toUpperCase()}</div><div style="font-weight:700;">SERV: ${sale.tableNumber}</div><div style="font-weight:700;">STAFF: ${sale.staffName}</div><div style="border-bottom:2px solid #000; margin:10px 0;"></div>${itemsHtml}<div style="font-size:22px; font-weight:900; border-top:2px solid #000; margin-top:12px; padding-top:8px; display:flex; justify-content:space-between;"><span>TOTAL:</span><span>₦${sale.total.toLocaleString()}</span></div><div style="margin-top:8px; font-size:16px; font-weight:700;">PAYMENT: ${sale.method.toUpperCase()}</div><div style="text-align:center; font-weight:900; margin-top:15px;">*** DUPLICATE ***</div></body></html>`;
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
      default: return <AlertCircle className="w-3 h-3 text-amber-500" />;
    }
  };

  const ShiftCard = ({ shift }: { shift: any }) => {
    const sales = groupedSales[shift.id] || [];
    const validSales = sales.filter(s => s.status !== "Canceled");
    const totalRevenue = validSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const settledRevenue = validSales.filter(s => s.status === "Completed").reduce((sum, s) => sum + (s.total || 0), 0);
    const pendingRevenue = validSales.filter(s => s.status === "Unsettled").reduce((sum, s) => sum + (s.total || 0), 0);

    return (
      <Collapsible className="w-full">
        <Card className="glass-card transition-all overflow-hidden mb-4 border-l-4 border-l-primary relative">
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-4 cursor-pointer group flex-1">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-headline font-bold text-white uppercase">{shift.staffName}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-2">
                      <Clock className="w-3 h-3" /> 
                      {shift.startTime?.toDate ? formatNigeriaTime(shift.startTime.toDate()) : "..."} 
                      {shift.endTime && ` — ${formatNigeriaTime(shift.endTime.toDate())}`}
                    </p>
                  </div>
                </div>
              </CollapsibleTrigger>

              <div className="flex flex-wrap items-center gap-6 text-right w-full md:w-auto">
                <div className="flex flex-col items-end flex-1 md:flex-none">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Settled</span>
                  <span className="text-lg font-headline font-bold text-emerald-500">₦{settledRevenue.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-end flex-1 md:flex-none">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Pending</span>
                  <span className="text-lg font-headline font-bold text-amber-500">₦{pendingRevenue.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-end flex-1 md:flex-none border-l border-white/10 pl-6">
                  <span className="text-[9px] font-bold text-primary uppercase">Total Session</span>
                  <span className="text-xl font-headline font-bold text-white">₦{totalRevenue.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-10 w-10 border-white/10" onClick={() => printShiftSummary(shift)} title="Print Shift Report">
                    <Printer className="w-4 h-4" />
                  </Button>
                  
                  {isAdmin && shift.status === 'closed' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive" title="Hide Duplicate Shift">
                          <EyeOff className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-card border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hide this duplicate shift?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the shift record for {shift.staffName} from the Global Audit. You can restore it later from the Admin Actions page.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleHideShift(shift)} className="bg-destructive text-destructive-foreground font-bold">
                            Hide Shift
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
            </div>
          </div>
        </Card>
        <CollapsibleContent className="space-y-3 pb-8 px-2 md:px-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5 animate-in slide-in-from-top-2">
            {sales.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic text-xs uppercase font-bold">No sales records found for this shift</div>
            ) : (
              sales.map((sale) => (
                <div key={sale.id} className={cn(
                  "p-5 flex flex-col gap-4 hover:bg-white/5 transition-colors",
                  sale.status === "Canceled" && "opacity-60 bg-red-500/[0.02]",
                  sale.status === "Unsettled" && "bg-amber-500/[0.03]"
                )}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Receipt</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-white">#{sale.id.slice(-8).toUpperCase()}</span>
                          {sale.status === "Canceled" ? <Badge variant="destructive" className="h-3.5 text-[8px] px-1 uppercase">Void</Badge> : sale.status === "Unsettled" ? <Badge variant="outline" className="h-3.5 text-[8px] px-1 border-amber-500/50 text-amber-500 uppercase">Pending</Badge> : <Badge variant="outline" className="h-3.5 text-[8px] px-1 border-emerald-500/50 text-emerald-500 uppercase">Paid</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Time</span>
                        <span className="text-xs">{sale.timestamp?.toDate ? formatNigeriaTime(sale.timestamp.toDate()) : "..."}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Point</span>
                        <span className="text-xs font-medium text-primary">{sale.tableNumber}</span>
                      </div>
                      <div className="flex flex-col items-end sm:items-start">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Grand Total</span>
                        <span className={cn("text-lg font-headline font-bold text-white", sale.status === "Canceled" && "line-through")}>₦{sale.total.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => printDucket(sale)}><Printer className="w-4 h-4" /></Button>
                      {sale.status === "Unsettled" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-8 text-[9px] bg-primary/10 text-primary hover:bg-primary/20" onClick={() => handleSettleSale(sale, "Cash")}>SETTLE</Button>
                        </div>
                      )}
                      {sale.status !== "Canceled" && (isAdmin || sale.shiftId === activeShift?.id) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-destructive"><XCircle className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent className="glass-card border-white/10"><AlertDialogHeader><AlertDialogTitle>Void Transaction?</AlertDialogTitle><AlertDialogDescription>This will restore stock items.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="bg-white/5">No</AlertDialogCancel><AlertDialogAction onClick={() => handleCancelSale(sale)} className="bg-destructive">Void</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  
                  {/* Detailed Items Breakdown */}
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Receipt className="w-3 h-3 text-primary/50" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Itemized Breakdown</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {sale.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-white/5 rounded-lg border border-white/5">
                          <span className="text-xs font-medium text-white truncate mr-2">{item.name}</span>
                          <span className="text-xs font-headline font-bold text-primary shrink-0">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight">Sales History</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <HistoryIcon className="w-4 h-4 text-primary" /> Multi-session Accountability (WAT)
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" asChild>
            <Link href="/bar/sales"><ShoppingCart className="w-4 h-4" /> New Sale (POS)</Link>
          </Button>
        </div>

        <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <TabsList className="bg-white/5 border border-white/10 p-1 shrink-0 h-12">
              <TabsTrigger value="shift" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
                <User className="w-4 h-4" /> Active Session
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="all" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
                  <HistoryIcon className="w-4 h-4" /> Global Audit
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 h-12 rounded-2xl">
                <Switch id="hide-voided" checked={hideVoided} onCheckedChange={setHideVoided} />
                <Label htmlFor="hide-voided" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground cursor-pointer">Hide Voided</Label>
              </div>
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter by staff or receipt..." 
                  className="pl-10 h-12 bg-white/5 border-white/10 rounded-2xl text-sm" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {viewMode === "shift" ? (
              activeShift ? (
                <div className="space-y-6">
                  <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="animate-pulse w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="font-bold text-white uppercase tracking-tight">Live: {activeShift.staffName} is currently on duty</span>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary uppercase font-bold text-[10px]">Session Live</Badge>
                  </div>
                  <ShiftCard shift={activeShift} />
                </div>
              ) : (
                <div className="py-24 text-center glass-card rounded-3xl border-dashed border-white/10 flex flex-col items-center gap-4 opacity-40">
                  <Clock className="w-12 h-12" />
                  <p className="font-headline font-bold uppercase tracking-widest">No worker is currently signed into a shift</p>
                </div>
              )
            ) : (
              <div className="space-y-6">
                {(shiftsLoading || salesLoading) ? (
                  <div className="py-20 text-center animate-pulse text-muted-foreground font-bold uppercase text-xs tracking-widest">Loading Audit Archive...</div>
                ) : paginatedShifts.length === 0 ? (
                  <div className="py-20 text-center opacity-40 italic text-sm">No historical records match your search.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-1">
                      {paginatedShifts.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift} />
                      ))}
                    </div>
                    
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Showing shifts {((currentPage-1) * SHIFTS_PER_PAGE) + 1} — {Math.min(currentPage * SHIFTS_PER_PAGE, filteredHistoryShifts.length)} of {filteredHistoryShifts.length}</p>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-12 px-6 rounded-2xl flex-1 sm:flex-none font-bold uppercase text-[10px] tracking-widest gap-2">
                            <ChevronLeft className="w-4 h-4" /> Prev
                          </Button>
                          <div className="flex items-center gap-2 px-6 h-12 bg-white/5 border border-white/10 rounded-2xl font-bold text-xs">
                             {currentPage} / {totalPages}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-12 px-6 rounded-2xl flex-1 sm:flex-none font-bold uppercase text-[10px] tracking-widest gap-2">
                            Next <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </Tabs>
      </div>
    </AppShell>
  );
}
