
"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Download,
  Calendar as CalendarIcon,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const trendData = [
  { day: "Mon", revenue: 4200 },
  { day: "Tue", revenue: 3800 },
  { day: "Wed", revenue: 5100 },
  { day: "Thu", revenue: 4800 },
  { day: "Fri", revenue: 7200 },
  { day: "Sat", revenue: 8900 },
  { day: "Sun", revenue: 6400 },
];

const trendConfig = {
  revenue: {
    label: "Daily Revenue ($)",
    color: "hsl(var(--secondary))",
  },
};

export default function ReportsPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Analytics & Reports</h1>
            <p className="text-muted-foreground">Track your bar's performance and revenue trends.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              This Week
            </Button>
            <Button className="bg-primary text-primary-foreground gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-card border border-border p-1 w-fit mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">By Item</TabsTrigger>
            <TabsTrigger value="categories">By Category</TabsTrigger>
            <TabsTrigger value="staff">By Staff</TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                    <h3 className="text-2xl font-bold font-headline mt-1">$12,482.00</h3>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-emerald-500">
                  <span>+15% from last week</span>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sales Count</p>
                    <h3 className="text-2xl font-bold font-headline mt-1">842</h3>
                  </div>
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-secondary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-emerald-500">
                  <span>+8% from last week</span>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Net Margin</p>
                    <h3 className="text-2xl font-bold font-headline mt-1">68.4%</h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <PieChart className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-destructive">
                  <span>-1.2% from last week</span>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Waste / Loss</p>
                    <h3 className="text-2xl font-bold font-headline mt-1">$240.50</h3>
                  </div>
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-destructive rotate-180" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-emerald-500">
                  <span>-42% from last week</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] pt-4">
                <ChartContainer config={trendConfig} className="h-full w-full">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                    <XAxis 
                      dataKey="day" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="var(--color-revenue)" 
                      fillOpacity={1} 
                      fill="url(#colorRev)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Top Selling Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {[
                    { name: "Old Fashioned", count: 142, revenue: "$1,988", progress: 85 },
                    { name: "Draft IPA", count: 118, revenue: "$1,003", progress: 72 },
                    { name: "House Red", count: 86, revenue: "$946", progress: 60 },
                    { name: "Margarita", count: 74, revenue: "$888", progress: 54 },
                    { name: "Sliders", count: 52, revenue: "$780", progress: 40 },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{item.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{item.count} sold</span>
                          <span className="font-headline font-bold text-primary">{item.revenue}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-primary to-secondary h-full rounded-full" 
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </div>
    </AppShell>
  );
}
