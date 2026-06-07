
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
  Calendar,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  ChevronDown
} from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const ITEMS_PER_PAGE = 10;

export default function SalesHistoryPage() {
  const firestore = useFirestore();
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

  const printDucket = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'PPP p') : 'N/A';
    const itemsHtml = sale.items.map((item: any) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
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
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              padding: 10mm; 
              font-size: 12px; 
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
            .header { font-size: 16px; margin-bottom: 4px; }
            .total { font-size: 14px; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="center bold header">NMCH BAR</div>
          <div class="center">Duplicate Ducket</div>
          <div class="divider"></div>
          <div>Date: ${dateStr}</div>
          <div>Receipt: #${sale.id.slice(-8).toUpperCase()}</div>
          <div>Service: ${sale.tableNumber}</div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          <div class="bold total" style="display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>₦${sale.total.toLocaleString()}</span>
          </div>
          <div style="margin-top: 4px;">Payment: ${sale.method}</div>
          <div class="divider"></div>
          <div class="center" style="margin-top: 10px;">*** DUPLICATE ***</div>
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
            <p className="text-muted-foreground">View past transactions and re-print duckets.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-white/10" asChild>
              <Link href="/bar/sales">
                <ShoppingCart className="w-4 h-4" /> New Sale
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Total Revenue</div>
              <div className="text-2xl font-bold font-headline mt-1 text-primary">
                ₦{sales?.reduce((sum, s) => sum + (s.total || 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Sales Count</div>
              <div className="text-2xl font-bold font-headline mt-1">{sales?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Avg. Ticket</div>
              <div className="text-2xl font-bold font-headline mt-1">
                ₦{sales?.length ? (sales.reduce((sum, s) => sum + (s.total || 0), 0) / sales.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
              </div>
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
                  placeholder="Filter by table, item, or method..." 
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
                    <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Receipt</span>
                          <span className="font-mono text-xs font-bold text-white">#{sale.id.slice(-8).toUpperCase()}</span>
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
                          <span className="text-lg font-headline font-bold text-white">₦{sale.total.toLocaleString()}</span>
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
                      <div className="max-w-md space-y-3">
                        <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] border-b border-white/10 pb-2">
                          <span>Items</span>
                          <span>Subtotal</span>
                        </div>
                        {sale.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-white/80">{item.name} <span className="text-muted-foreground">x{item.quantity}</span></span>
                            <span className="font-headline font-bold">₦{(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="pt-3 flex items-center justify-between border-t border-white/5">
                          <Badge variant="outline" className="gap-1.5 border-white/10 text-[10px] uppercase font-bold py-1">
                            {getMethodIcon(sale.method)} {sale.method}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'PPP p') : 'N/A'}
                          </span>
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
