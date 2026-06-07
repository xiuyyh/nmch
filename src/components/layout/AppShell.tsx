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
  Settings,
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
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-background/50 backdrop-blur-2xl">
      <SidebarHeader className="p-6">
        <div className={cn(
          "flex items-center gap-3 transition-all duration-500",
          isCollapsed ? "justify-center" : "px-2"
        )}>
          <div className="p-2.5 bg-primary rounded-xl shrink-0 shadow-[0_0_25px_rgba(var(--primary),0.3)] neon-glow-primary transform rotate-3 hover:rotate-0 transition-transform duration-500">
            <Beer className="w-6 h-6 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <span className="font-headline font-bold text-2xl tracking-tighter text-white whitespace-nowrap bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
              TapTrack
            </span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-6 space-y-4">
        <SidebarMenu className="gap-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  asChild 
                  isActive={isActive}
                  tooltip={item.name}
                  className={cn(
                    "relative transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] h-12 rounded-xl group",
                    "hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.2)] neon-glow-primary border border-white/20" 
                      : "text-muted-foreground bg-white/5 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10"
                  )}
                >
                  <Link href={item.href} className="flex items-center gap-3 px-4">
                    <div className={cn(
                      "transition-transform duration-500 group-hover:scale-110",
                      isActive ? "text-primary-foreground" : "text-primary/70 group-hover:text-primary"
                    )}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium tracking-wide">{item.name}</span>
                    {isActive && (
                      <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-white/5 mt-auto bg-black/20">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground hover:text-white hover:bg-white/5 h-11 rounded-xl transition-all duration-300">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="mt-2">
            <div className={cn(
              "flex items-center gap-3 transition-all duration-500 p-2 rounded-2xl bg-white/5 border border-white/5",
              isCollapsed ? "justify-center" : "px-3"
            )}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-secondary to-primary/50 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner">
                JD
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate text-white/90">John Doe</span>
                  <span className="text-[10px] text-primary/70 truncate uppercase tracking-[0.2em] font-bold">Manager</span>
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
      <div className="flex h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-900 via-background to-black w-full">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Navigation Bar */}
          <header className="flex items-center h-20 px-4 md:px-10 border-b border-white/5 bg-background/30 backdrop-blur-xl sticky top-0 z-20">
            <SidebarTrigger className="mr-6 text-muted-foreground hover:text-primary transition-all duration-300 scale-110" />
            <div className="md:hidden flex items-center gap-2 mr-auto">
              <Beer className="w-6 h-6 text-primary" />
              <span className="font-headline font-bold text-xl tracking-tighter">TapTrack</span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 scroll-smooth">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
