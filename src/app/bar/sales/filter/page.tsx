
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Printer, 
  Filter, 
  Calendar, 
  Package, 
  DollarSign,
  ArrowRight,
  Loader2,
  FileText
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, where, Timestamp } from "firebase/firestore";
import { formatNigeriaTime, cn } from "@/lib/utils";
import { startOfDay, endOfDay, parse } from "date-fns";

export default function SalesFilterPage() {
  const firestore = useFirestore();
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  const [searchItem, setSearchItem] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Parse YYYY-MM-DD strings to Dates for Firestore
  const dateRange = useMemo(() => {
    if (!startDateStr || !endDateStr) return null;
    try {
      const start = startOfDay(parse(startDateStr, "yyyy-MM-dd", new Date()));
      const end = endOfDay(parse(endDateStr, "yyyy-MM-dd", new Date()));
      return { start, end };
    } catch (e) {
      return null;
    }
  }, [startDateStr, endDateStr]);

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

  // Aggregate specifically for the filtered item
  const report = useMemo(() => {
    if (!sales || !searchItem) return { totalQty: 0, totalValue: 0, items: [] };

    let qty = 0;
    let value = 0;
    const itemsMap: Record<string, { qty: number; value: number }> = {};

    sales.forEach(sale => {
      if (sale.status === "Canceled") return;
      
      sale.items?.forEach((item: any) => {
        if (item.name?.toLowerCase().includes(searchItem.toLowerCase())) {
          qty += item.quantity;
          value += (item.price * item.quantity);

          if (!itemsMap[item.name]) {
            itemsMap[item.name] = { qty: 0, value: 0 };
          }
          itemsMap[item.name].qty += item.quantity;
          itemsMap[item.name].value += (item.price * item.quantity);
        }
      });
    });

    return {
      totalQty: qty,
      totalValue: value,
      items: Object.entries(itemsMap).map(([name, data]) => ({ name, ...data }))
    };
  }, [sales, searchItem]);

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !dateRange) return;

    const itemsHtml = report.items
      .sort((a, b) => b.qty - a.qty)
      .map(item => `
        <tr style="border-bottom: 1px dashed #000;">
          <td style="padding: 8px 0; font-weight: 800;">${item.name}</td>
          <td style="padding: 8px 0; text-align: center; font-weight: 800;">x${item.qty}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 800;">₦${item.value.toLocaleString()}</td>
        </tr>
      `).join('');

    const html = `
      <html>
        <head>
          <title>Period Report - ${searchItem}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: 'Arial', sans-serif; width: 80mm; padding: 5mm; color: #000; font-size: 13px; line-height: 1.4; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { font-size: 18px; margin: 0; text-transform: uppercase; }
            .header p { font-size: 11px; margin: 4px 0; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; font-size: 10px; text-transform: uppercase; }
            .total-section { margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; }
            .total-row { display: flex; justify-content: space-between; font-weight: 900; font-size: 16px; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NIGHTINGALE HOTEL</h1>
            <p>ITEM SALES AUDIT REPORT</p>
            <p>PERIOD: ${startDateStr} TO ${endDateStr}</p>
            <p>FILTER: "${searchItem.toUpperCase()}"</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span>TOTAL ITEMS:</span>
              <span>${report.totalQty}</span>
            </div>
            <div class="total-row" style="margin-top: 5px; font-size: 18px;">
              <span>TOTAL VALUE:</span>
              <span>₦${report.totalValue.toLocaleString()}</span>
            </div>
          </div>

          <div style="text-align: center; margin-top: 30px; font-size: 9px; font-weight: bold;">
            *** SUMMARIZED AUDIT LOG ***<br>
            PRINTED: ${formatNigeriaTime(new Date(), true)}
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
      <div className="flex flex-col gap-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <Filter className="w-8 h-8 text-primary" /> Sales Filter
            </h1>
            <p className="text-muted-foreground mt-1">Audit specific item performance over custom periods.</p>
          </div>
          {report.items.length > 0 && (
            <Button onClick={printReport} className="bg-primary text-primary-foreground font-bold shadow-xl h-12 rounded-xl px-8 gap-2">
              <Printer className="w-5 h-5" /> Print Summarized Ducket
            </Button>
          )}
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="bg-white/5 border-b border-white/5 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-primary/70">Start Date (YYYY-MM-DD)</Label>
                <div className="relative">
                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input 
                    placeholder="2024-01-01" 
                    value={startDateStr} 
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="bg-white/5 border-white/10 pl-10 h-12 rounded-xl font-mono" 
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-primary/70">End Date (YYYY-MM-DD)</Label>
                <div className="relative">
                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input 
                    placeholder="2024-01-20" 
                    value={endDateStr} 
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="bg-white/5 border-white/10 pl-10 h-12 rounded-xl font-mono" 
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-primary/70">Search Item Name</Label>
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input 
                    placeholder="e.g. Nutri Yo" 
                    value={searchItem} 
                    onChange={(e) => setSearchItem(e.target.value)}
                    className="bg-white/5 border-white/10 pl-10 h-12 rounded-xl font-bold" 
                   />
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {!dateRange ? (
              <div className="py-24 text-center flex flex-col items-center justify-center opacity-40">
                <FileText className="w-16 h-16 mb-4" />
                <h3 className="text-xl font-headline font-bold uppercase">Ready to Filter</h3>
                <p className="text-sm italic mt-2">Enter a valid date range and item name above to generate report.</p>
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
                <p className="text-sm italic mt-2">No items matching "{searchItem}" were sold in this period.</p>
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
                    </div>
                  </div>
                  <div className="p-8 space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Total Generated Revenue</span>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <span className="text-5xl font-headline font-bold text-emerald-500">₦{report.totalValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">Itemized Summary</h3>
                  <div className="space-y-2">
                    {report.items.sort((a, b) => b.qty - a.qty).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition-colors">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center font-headline font-bold text-primary">
                             {idx + 1}
                           </div>
                           <span className="font-bold text-lg">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Qty</span>
                            <span className="text-2xl font-headline font-bold text-white">x{item.qty}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Revenue</span>
                            <span className="text-2xl font-headline font-bold text-primary">₦{item.value.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
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
