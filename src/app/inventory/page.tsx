
"use client";

import React, { useState } from "react";
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
import { Search, Plus, Edit2, AlertTriangle, RefreshCw } from "lucide-react";

const initialStock = [
  { id: "1", name: "Buffalo Trace Bourbon", category: "Whiskey", stock: 12, unit: "Bottles", min: 3, lastUpdated: "2 hours ago" },
  { id: "2", name: "Tito's Vodka", category: "Vodka", stock: 2, unit: "Bottles", min: 4, lastUpdated: "1 day ago" },
  { id: "3", name: "Draft IPA Keg", category: "Beer", stock: 4, unit: "Kegs", min: 2, lastUpdated: "3 hours ago" },
  { id: "4", name: "Prosecco", category: "Wine", stock: 18, unit: "Bottles", min: 6, lastUpdated: "5 hours ago" },
  { id: "5", name: "Angostura Bitters", category: "Mixers", stock: 1, unit: "Bottles", min: 2, lastUpdated: "2 days ago" },
  { id: "6", name: "Lemon Juice", category: "Fresh", stock: 5000, unit: "ml", min: 1000, lastUpdated: "1 hour ago" },
];

export default function InventoryPage() {
  const [stockItems, setStockItems] = useState(initialStock);
  const [search, setSearch] = useState("");

  const filteredItems = stockItems.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Inventory</h1>
            <p className="text-muted-foreground">Manage and track your bar stock levels.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sync
            </Button>
            <Button className="bg-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">$8,420.00</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive font-headline">3 Items</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recently Restocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary font-headline">12 Items</div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Stock</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter stock..." 
                  className="pl-10 h-9 bg-background/50" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-bold">Item Name</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="font-bold">Current Stock</TableHead>
                  <TableHead className="font-bold">Minimum Threshold</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isLow = item.stock <= item.min;
                  return (
                    <TableRow key={item.id} className="border-border hover:bg-white/5">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell>
                        <span className="font-headline font-bold">{item.stock}</span> {item.unit}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.min} {item.unit}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                            Healthy
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
