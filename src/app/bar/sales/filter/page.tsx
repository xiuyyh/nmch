
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Printer, 
  Filter, 
  Calendar as CalendarIcon, 
  Package, 
  Banknote, 
  ArrowRight,
  Loader2,
  FileText,
  FileBarChart,
  History,
  CheckCircle2,
  X
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, where } from "firebase/firestore";
import { formatNigeriaTime, cn } from "@/lib/utils";
import { startOfDay, endOfDay, format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

export default function SalesFilterPage() {
  const firestore = useFirestore();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [searchItem, setSearchItem] = useState("");
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  // Fetch Inventory for selection list
  const inventoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "inventory"), orderBy("name"));
  }, [firestore]);
  const { data: inventory } = useCollection(inventoryQuery);

  const dateRange = useMemo(() => {
    if (!startDate || !endDate) return null;
    return { 
      start: startOfDay(startDate), 
      end: endOfDay(endDate) 
    };
  }, [startDate, endDate]);

  const salesQuery = useMemo(() => {
    if (!firestore || !dateRange) return null;
    return query(
      collection(firestore, "sales"),
      where("timestamp", ">=", dateRange.start),
      where("timestamp", "<=", dateRange.end),
      orderBy("timestamp", "desc")
    );
  }, [firestore, dateRange]);

  const { data: sales, loading } = useCollection(salesQuery);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    if (!searchItem) return inventory.slice(0, 10);
    return inventory.filter(i => i.name.toLowerCase().includes(searchItem.toLowerCase())).slice(0, 10);
  }, [inventory, searchItem]);

  const report = useMemo(() => {
    if (!sales) return { totalQty: 0, totalValue: 0, items: [], transactions: [] };

    let qty = 0;
    let value = 0;
    const itemsMap: Record<string, { qty: number; value: number }> = {};
    const transactions: any[] = [];

    sales.forEach(sale => {
      if (sale.status === "Canceled") return;
      
      let saleHasMatch = false;
      sale.items?.forEach((item: any) => {
        // If an item is selected, we only count that exact item. 
        // If not, we filter by the text search item name.
        const isMatch = selectedItemName 
          ? item.name === selectedItemName 
          : (!searchItem || item.name?.toLowerCase().includes(searchItem.toLowerCase()));
        
        if (isMatch) {
          saleHasMatch = true;
          qty += item.quantity;
          value += (item.price * item.quantity);

          if (!itemsMap[item.name]) {
            itemsMap[item.name] = { qty: 0, value: 0 };
          }
          itemsMap[item.name].qty += item.quantity;
          itemsMap[item.name].value += (item.price * item.quantity);
        }
      });

      if (saleHasMatch) {
        transactions.push(sale);
      }
    });

    return {
      totalQty: qty,
      totalValue: value,
      items: Object.entries(itemsMap).map(([name, data]) => ({ name, ...data })),
      transactions
    };
  }, [sales, searchItem, selectedItemName]);

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !dateRange) return;

    const itemsHtml = report.items
      .sort((a, b) => b.qty - a.qty)
      .map(item => `
        <tr style="border-bottom: 1px dashed #444;">
          <td style="padding: 8px 0; font-size: 14px;">${item.name.toUpperCase()}</td>
          <td style="padding: 8px 0; text-align: center; font-weight: bold; font-size: 14px;">x${item.qty}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 14px;">₦${item.value.toLocaleString()}</td>
        </tr>
      `).join('');

    const html = `
      <html>
        <head>
          <title>Period Report</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: 'Helvetica', 'Arial', sans-serif; width: 80mm; padding: 10mm; color: #000; font-size: 13px; line-height: 1.4; margin: 0 auto; }
            .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { font-size: 22px; margin: 0; text-transform: uppercase; font-weight: 900; }
            .header p { font-size: 12px; margin: 4px 0; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 2px solid #000; padding: 6px 0; font-size: 11px; text-transform: uppercase; font-weight: 900; }
            .total-section { margin-top: 20px; border-top: 3px solid #000; padding-top: 10px; }
            .total-row { display: flex; justify-content: space-between; font-weight: 900; font-size: 18px; margin-bottom: 5px; }
            .meta-info { font-size: 11px; margin-top: 5px; text-transform: uppercase; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NIGHTINGALE HOTEL</h1>
            <p>ITEM PERFORMANCE AUDIT</p>
          </div>
          
          <div class="meta-info">START: ${startDate ? format(startDate, "dd/MM/yyyy") : "N/A"}</div>
          <div class="meta-info">END: ${endDate ? format(endDate, "dd/MM/yyyy") : "N/A"}</div>
          <div class="meta-info">TARGET: "${selectedItemName || (searchItem ? searchItem.toUpperCase() : 'GLOBAL AUDIT')}"</div>
          
          <div style="border-bottom: 2px solid #000; margin: 10px 0;"></div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">ITEM</th>
                <th style="text-align: center; width: 20%;">QTY</th>
                <th style="text-align: right; width: 30%;">VALUE</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span style="font-size: 14px;">TOTAL VOLUME:</span>
              <span style="font-size: 14px;">${report.totalQty}</span>
            </div>
            <div class="total-row" style="margin-top: 8px; font-size: 22px;">
              <span>TOTAL VALUE:</span>
              <span>₦${report.totalValue.toLocaleString()}</span>
            </div>
          </div>

          <div style="text-align: center; margin-top: 40px; font-size: 10px; font-weight: 900; border-top: 1px dashed #000; padding-top: 10px;">
            *** AUDIT SUMMARY LOG ***<br>
            PRINTED: ${formatNigeriaTime(new Date(), true).toUpperCase()}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <Filter className="w-8 h-8 text-primary" /> Item Audit
            </h1>
            <p className="text-muted-foreground mt-1">Audit specific item performance or global sales over custom periods.</p>
          </div>
          {report.items.length > 0 && (
            <Button onClick={printReport} className="bg-primary text-primary-foreground font-bold shadow-xl h-12 rounded-xl px-8 gap-2">
              <Printer className="w-5 h-5" /> Print Audit Report
            </Button>
          )}
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="bg-white/5 border-b border-white/5 py-6 px-4 sm:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-primary/70">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 justify-start text-left font-normal bg-white/5 border-white/10 rounded-xl",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 glass-card" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-primary/70">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 justify-start text-left font-normal bg-white/5 border-white/10 rounded-xl",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 glass-card" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2 relative">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-primary/70">Target Item</Label>
                {selectedItemName ? (
                  <div className="flex items-center justify-between h-12 px-4 bg-primary/10 border border-primary/30 rounded-xl animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-bold text-sm text-white truncate uppercase">{selectedItemName}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setSelectedItemName(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search inventory..." 
                      value={searchItem} 
                      onChange={(e) => setSearchItem(e.target.value)}
                      className="bg-white/5 border-white/10 pl-10 h-12 rounded-xl font-bold" 
                    />
                    {searchItem && filteredInventory.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-black border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                        {filteredInventory.map(item => (
                          <button
                            key={item.id}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 text-xs font-bold uppercase transition-colors flex items-center justify-between group"
                            onClick={() => {
                              setSelectedItemName(item.name);
                              setSearchItem("");
                            }}
                          >
                            <span className="group-hover:text-primary">{item.name}</span>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {!dateRange ? (
              <div className="py-24 text-center flex flex-col items-center justify-center opacity-40">
                <History className="w-16 h-16 mb-4" />
                <h3 className="text-xl font-headline font-bold uppercase">Configure Audit</h3>
                <p className="text-sm italic mt-2">Select a date range to begin scanning sales records.</p>
              </div>
            ) : loading ? (
              <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="font-headline font-bold uppercase text-muted-foreground animate-pulse">Scanning Archive...</p>
              </div>
            ) : report.items.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center justify-center opacity-40">
                <Package className="w-16 h-16 mb-4" />
                <h3 className="text-xl font-headline font-bold uppercase">No Matches Found</h3>
                <p className="text-sm italic mt-2">No sales matching your criteria were found in this period.</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 border-b border-white/5 bg-white/[0.02]">
                  <div className="p-8 border-r border-white/5 space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Total Quantity Sold</span>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Package className="w-6 h-6" />
                      </div>
                      <span className="text-5xl font-headline font-bold text-white">{report.totalQty}</span>
                      <span className="text-sm font-bold text-muted-foreground uppercase mt-4">Units</span>
                    </div>
                  </div>
                  <div className="p-8 space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Total Revenue Impact</span>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <span className="text-5xl font-headline font-bold text-emerald-500">₦{report.totalValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <FileBarChart className="w-5 h-5 text-primary" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Itemized Summary</h3>
                  </div>
                  
                  <div className="rounded-2xl border border-white/5 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-10">Product Name</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center h-10">Total Volume</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right h-10 pr-6">Total Generated (₦)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.items.sort((a, b) => b.qty - a.qty).map((item, idx) => (
                          <TableRow key={idx} className="border-white/5 hover:bg-white/[0.03] transition-colors h-14">
                            <TableCell className="font-bold text-white uppercase text-xs">{item.name}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-white/5 border-white/10 font-headline font-bold text-sm px-3">x{item.qty}</Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6 font-headline font-bold text-primary text-lg">
                              ₦{item.value.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="p-4 sm:p-8 pt-0">
                  <div className="flex items-center gap-2 mb-6">
                    <History className="w-5 h-5 text-primary" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Transaction Log</h3>
                  </div>
                  
                  <div className="rounded-2xl border border-white/5 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-10">Receipt #</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-10">Time</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-10">Point</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right h-10 pr-6">Sale Total (₦)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.transactions.map((sale) => (
                          <TableRow key={sale.id} className="border-white/5 hover:bg-white/[0.03] transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-white uppercase">#{sale.id.slice(-8)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatNigeriaTime(sale.timestamp.toDate())}</TableCell>
                            <TableCell className="text-xs font-medium text-primary uppercase">{sale.tableNumber}</TableCell>
                            <TableCell className="text-right pr-6 font-bold text-white">₦{sale.total?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
