"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Menu as MenuIcon, 
  ClipboardList, 
  BarChart3,
  Beer,
  ChevronLeft,
  Settings,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
  useSidebar
} from "@/components/ui/sidebar";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Quick Sale", href: "/pos", icon: ShoppingCart },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Menu", href: "/menu", icon: MenuIcon },
  { name: "Stock Requests", href: "/requests", icon: ClipboardList },
  { name: "Reports", href: "/reports", icon: BarChart3 },
];

function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-card/30 backdrop-blur-xl">
      <SidebarHeader className="p-4">
        <div className={cn(
          "flex items-center gap-3 transition-all duration-300",
          isCollapsed ? "justify-center" : "px-2"
        )}>
          <div className="p-2 bg-primary rounded-lg shrink-0 neon-glow-primary">
            <Beer className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <span className="font-headline font-bold text-xl tracking-tight text-white whitespace-nowrap">
              TapTrack
            </span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4">
        <SidebarMenu>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  asChild 
                  isActive={isActive}
                  tooltip={item.name}
                  className={cn(
                    "transition-all duration-200 h-11",
                    isActive 
                      ? "bg-primary text-primary-foreground neon-glow-primary hover:bg-primary/90 hover:text-primary-foreground" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "group-hover:text-primary")} />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground hover:text-white hover:bg-white/5 h-11">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className={cn(
              "flex items-center gap-3 transition-all duration-300",
              isCollapsed ? "justify-center py-2" : "px-2 py-2"
            )}>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground shrink-0">
                JD
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">John Doe</span>
                  <span className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">Manager</span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background w-full">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Navigation Bar */}
          <header className="flex items-center h-16 px-4 md:px-8 border-b border-white/5 bg-card/20 backdrop-blur-md sticky top-0 z-10">
            <SidebarTrigger className="mr-4 text-muted-foreground hover:text-primary transition-colors" />
            <div className="md:hidden flex items-center gap-2 mr-auto">
              <Beer className="w-6 h-6 text-primary" />
              <span className="font-headline font-bold text-lg">TapTrack</span>
            </div>
            
            <div className="ml-auto flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Shift Status</span>
                <span className="text-xs text-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active • 4h 12m
                </span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
