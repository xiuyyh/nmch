
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
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
import { Switch } from "@/components/ui/switch";
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  ChevronDown,
  XCircle,
  Clock,
  User,
  ShieldCheck,
  EyeOff,
  FileText,
  Loader2,
  CalendarDays
} from "lucide-react";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, increment, serverTimestamp, limit, addDoc } from "firebase/firestore";
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
import { useToast } from "@/hooks/use-toast";

const SHIFTS_PER_PAGE = 10;

export default function GlobalAuditPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hideVoided, setHideVoided] = useState(false);
  
  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userRecord } = useDoc(userRef);
  const isAdmin = userRecord?.role === 'admin';

  // 1. Get Global Shifts
  const shiftsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "shifts"), 
      orderBy("startTime", "desc"), 
      limit(200)
    );
  }, [firestore]);
  const { data: allShifts, loading: shiftsLoading } = useCollection(shiftsQuery);

  // 2. Get All Recent Sales for grouping
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

  const filteredShifts = useMemo(() => {
    if (!allShifts) return [];
    return allShifts.filter(s => {
      if (s.hidden) return false;
      if (!search) return true;
      return (
        s.staffName?.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [allShifts, search]);

  const totalPages = Math.max(1, Math.ceil(filteredShifts.length / SHIFTS_PER_PAGE));
  const paginatedShifts = useMemo(() => {
    const start = (currentPage - 1) * SHIFTS_PER_PAGE;
    return filteredShifts.slice(start, start + SHIFTS_PER_PAGE);
  }, [filteredShifts, currentPage]);

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
        toast({ title: "Shift Hidden", description: "Session removed from audit logs." });
      });
  };

  const printDucket = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateStr = sale.timestamp?.toDate ? formatNigeriaTime(sale.timestamp.toDate()) : "N/A";
    const itemsHtml = sale.items.map((item: any) => `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:800;">
        <span>${item.name} x ${item.quantity}</span>
        <span>₦${(item.price * item.quantity).toLocaleString()}</span>
      </div>
    `).join('');
    
    const html = `<html><head><style>@page { size: 80mm auto; margin: 0; } body { font-family: sans-serif; width: 80mm; padding: 10mm; font-size: 14px; color: #000; }</style></head><body>
      <div style="text-align:center; font-size:22px; font-weight:900;">NIGHTINGALE HOTEL</div>
      <div style="text-align:center; font-size:16px;">DUPLICATE RECEIPT</div>
      <div style="border-bottom:2px solid #000; margin:10px 0;"></div>
      <div style="font-weight:700;">REC#: ${sale.id.slice(-8).toUpperCase()}</div>
      <div style="font-weight:700;">STAFF: ${sale.staffName}</div>
      <div style="font-weight:700;">TIME: ${dateStr}</div>
      <div style="border-bottom:1px solid #000; margin:10px 0;"></div>
      ${itemsHtml}
      <div style="border-top:2px solid #000; margin-top:10px; padding-top:8px; display:flex; justify-content:space-between; font-size:18px; font-weight:900;">
        <span>TOTAL:</span><span>₦${sale.total.toLocaleString()}</span>
      </div>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const ShiftDucket = ({ shift }: { shift: any }) => {
    const sales = groupedSales[shift.id] || [];
    const validSales = sales.filter(s => s.status !== "Canceled");
    const totalRev = validSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const settledRev = validSales.filter(s => s.status === "Completed").reduce((sum, s) => sum + (s.total || 0), 0);
    const pendingRev = validSales.filter(s => s.status === "Unsettled").reduce((sum, s) => sum + (s.total || 0), 0);

    return (
      <Collapsible className="w-full">
        <Card className="glass-card mb-4 border-l-4 border-l-primary overflow-hidden group">
          <div className="p-4 md:p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-4 cursor-pointer flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                    <User className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-headline font-bold text-white uppercase tracking-tight">{shift.staffName}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> 
                      {shift.startTime?.toDate ? formatNigeriaTime(shift.startTime.toDate()) : "..."} 
                      {shift.endTime && ` — ${formatNigeriaTime(shift.endTime.toDate())}`}
                    </p>
                  </div>
                </div>
              </CollapsibleTrigger>

              <div className="flex flex-wrap items-center gap-8 w-full lg:w-auto">
                 <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Settled</span>
                  <span className="text-xl font-headline font-bold text-emerald-500">₦{settledRev.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Pending</span>
                  <span className="text-xl font-headline font-bold text-amber-500">₦{pendingRev.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-end border-l border-white/10 pl-8">
                  <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Total Sessions</span>
                  <span className="text-2xl font-headline font-bold text-white">₦{totalRev.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center gap-2 ml-auto lg:ml-0">
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive">
                          <EyeOff className="w-5 h-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-card border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hide Duplicate Shift?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {shift.staffName}'s session from audit visibility. You can restore it in Admin Actions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleHideShift(shift)} className="bg-destructive text-destructive-foreground font-bold">
                            Confirm Hide
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                      <ChevronDown className="w-6 h-6 text-muted-foreground" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <CollapsibleContent className="space-y-3 pb-8 px-2 md:px-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5 animate-in slide-in-from-top-2">
            {sales.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic text-xs uppercase font-bold">No sales records found</div>
            ) : (
              sales.map((sale) => (
                <div key={sale.id} className={cn(
                  "p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors",
                  sale.status === "Canceled" && "opacity-40 grayscale bg-red-500/[0.02]"
                )}>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Receipt</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">#{sale.id.slice(-8).toUpperCase()}</span>
                        {sale.status === "Canceled" && <Badge variant="destructive" className="h-4 text-[8px] px-1 uppercase">VOID</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Timestamp</span>
                      <span className="text-xs text-white/80">{sale.timestamp?.toDate ? formatNigeriaTime(sale.timestamp.toDate()) : "..."}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Point of Sale</span>
                      <span className="text-xs font-bold text-primary">{sale.tableNumber}</span>
                    </div>
                    <div className="flex flex-col items-end sm:items-start">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Grand Total</span>
                      <span className={cn("text-xl font-headline font-bold text-white", sale.status === "Canceled" && "line-through opacity-50")}>
                        ₦{sale.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground self-end sm:self-center" onClick={() => printDucket(sale)}>
                    <Printer className="w-5 h-5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <RoleGuard allowedRoles={["admin", "bar"]}>
      <AppShell>
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-primary" /> Global Shift Audit
              </h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary/60" /> Detailed Session performance & verification.
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 h-14 rounded-2xl">
              <Switch id="hide-voided-audit" checked={hideVoided} onCheckedChange={setHideVoided} />
              <Label htmlFor="hide-voided-audit" className="text-xs uppercase font-bold tracking-widest text-muted-foreground cursor-pointer">
                Hide Voided Sales
              </Label>
            </div>

            <div className="relative flex-1 w-full lg:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Filter by staff name or shift ID..." 
                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-base" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-6">
            {(shiftsLoading || salesLoading) ? (
              <div className="py-32 text-center flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="font-headline font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Scanning Data Repositories...</p>
              </div>
            ) : paginatedShifts.length === 0 ? (
              <div className="py-32 text-center flex flex-col items-center gap-4 opacity-40">
                <FileText className="w-16 h-16" />
                <p className="font-headline font-bold uppercase tracking-widest">No shift history found matching criteria</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2">
                  {paginatedShifts.map((shift) => (
                    <ShiftDucket key={shift.id} shift={shift} />
                  ))}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 border-t border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">
                      Archived Shifts {((currentPage-1) * SHIFTS_PER_PAGE) + 1} — {Math.min(currentPage * SHIFTS_PER_PAGE, filteredShifts.length)} of {filteredShifts.length}
                    </p>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-12 px-8 rounded-2xl flex-1 sm:flex-none font-bold uppercase text-[10px] tracking-widest gap-2">
                        <ChevronLeft className="w-4 h-4" /> Prev
                      </Button>
                      <div className="flex items-center justify-center px-8 h-12 bg-white/5 border border-white/10 rounded-2xl font-headline font-bold text-sm min-w-[100px]">
                         {currentPage} / {totalPages}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-12 px-8 rounded-2xl flex-1 sm:flex-none font-bold uppercase text-[10px] tracking-widest gap-2">
                        Next <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
