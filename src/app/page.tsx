
"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  AlertCircle, 
  PackageCheck, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartData = [
  { time: "4pm", sales: 120 },
  { time: "5pm", sales: 240 },
  { time: "6pm", sales: 180 },
  { time: "7pm", sales: 350 },
  { time: "8pm", sales: 420 },
  { time: "9pm", sales: 380 },
  { time: "10pm", sales: 510 },
];

const chartConfig = {
  sales: {
    label: "Sales ($)",
    color: "hsl(var(--primary))",
  },
};

export default function Dashboard() {
  const stats = [
    { label: "Today's Revenue", value: "$1,248.50", trend: "+12.5%", icon: DollarSign, color: "text-primary" },
    { label: "Active Orders", value: "8", trend: "-2", icon: PackageCheck, color: "text-secondary" },
    { label: "Items to Restock", value: "5", trend: "+1", icon: AlertCircle, color: "text-destructive" },
    { label: "Avg. Sale Value", value: "$18.20", trend: "+4.2%", icon: TrendingUp, color: "text-primary" },
  ];

  const recentSales = [
    { id: "1", item: "Old Fashioned", time: "2 mins ago", price: "$14.00" },
    { id: "2", item: "Draft IPA (Pint)", time: "5 mins ago", price: "$8.50" },
    { id: "3", item: "House Red Wine", time: "12 mins ago", price: "$11.00" },
    { id: "4", item: "Truffle Fries", time: "15 mins ago", price: "$12.00" },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-headline font-bold mb-2">Good Evening, John</h1>
          <p className="text-muted-foreground">Here's what's happening at the bar tonight.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center text-xs mt-1">
                  {stat.trend.startsWith('+') ? (
                    <ArrowUpRight className="w-3 h-3 text-emerald-500 mr-1" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-destructive mr-1" />
                  )}
                  <span className={stat.trend.startsWith('+') ? "text-emerald-500" : "text-destructive"}>
                    {stat.trend} from yesterday
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <Card className="lg:col-span-2 glass-card">
            <CardHeader>
              <CardTitle>Sales Velocity</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full pt-4">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                  <XAxis 
                    dataKey="time" 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="sales" 
                    fill="var(--color-sales)" 
                    radius={[4, 4, 0, 0]} 
                    className="neon-glow-primary"
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">{sale.item}</span>
                      <span className="text-xs text-muted-foreground">{sale.time}</span>
                    </div>
                    <span className="font-headline font-bold text-primary">{sale.price}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
