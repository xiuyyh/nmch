
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  ClipboardList, 
  LogOut,
  ChevronRight,
  Wine,
  Warehouse,
  UtensilsCrossed,
  Contact,
  Sparkles,
  Menu,
  X,
  History as HistoryIcon,
  Lock,
  RefreshCw,
  PackagePlus,
  CookingPot
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";

const LOGO_URL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQw8oatrplLFy0o-ghLuTFtu1gKQqYtgfXw0A&s";

const departments = [
  {
    title: "Bar Operations",
    icon: Wine,
    items: [
      { name: "Bar Sales", href: "/bar/sales", icon: ShoppingCart },
      { name: "Sales History", href: "/bar/sales/history", icon: HistoryIcon },
      { name: "Restock", href: "/bar/restock", icon: RefreshCw },
      { name: "End of Day", href: "/bar/end-of-day", icon: Lock },
    ],
  },
  {
    title: "Store",
    icon: Warehouse,
    items: [
      { name: "Bar Inventory", href: "/inventory", icon: Package },
      { name: "Stock Requests", href: "/requests", icon: ClipboardList },
      { name: "Warehouse Stock", href: "/store/warehouse", icon: Warehouse },
      { name: "New Supply", href: "/store/suppliers", icon: PackagePlus },
    ],
  },
  {
    title: "Kitchen",
    icon: UtensilsCrossed,
    items: [
      { name: "Orders", href: "/kitchen/orders", icon: CookingPot },
    ],
  },
  {
    title: "Front Desk",
    icon: Contact,
    items: [
      { name: "Bookings", href: "/front-desk/bookings" },
      { name: "Guest List", href: "/front-desk/guests" },
      { name: "Check-in", href: "/front-desk/check-in" },
    ],
  },
  {
    title: "Cleaning",
    icon: Sparkles,
    items: [
      { name: "Daily Schedule", href: "/cleaning/schedule" },
      { name: "Supplies Inventory", href: "/cleaning/supplies" },
      { name: "Maintenance Logs", href: "/cleaning/logs" },
    ],
  },
];

function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const auth = useAuth();
  const { user } = useUser();
  const isCollapsed = state === "collapsed";
  const defaultAvatar = LOGO_URL;

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-background/50 backdrop-blur-3xl shadow-2xl">
      <SidebarHeader className="p-6">
        <div className={cn(
          "flex items-center gap-3 transition-all duration-500",
          isCollapsed ? "justify-center" : "px-2"
        )}>
          <div className="w-10 h-10 bg-primary/20 rounded-xl shrink-0 shadow-[0_0_25px_rgba(var(--primary),0.3)] neon-glow-primary transform rotate-3 hover:rotate-0 transition-transform duration-500 overflow-hidden border border-primary/30">
            <img src={LOGO_URL} alt="NMCH Logo" className="w-full h-full object-cover" />
          </div>
          {!isCollapsed && (
            <span className="font-headline font-bold text-2xl tracking-tighter text-white whitespace-nowrap bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
              NMCH
            </span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-6">
        <SidebarMenu className="gap-2">
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={pathname === "/"}
              tooltip="Overview"
              className={cn(
                "transition-all duration-300 h-12 rounded-xl group/btn overflow-hidden",
                pathname === "/" 
                  ? "bg-primary text-primary-foreground neon-glow-primary font-bold shadow-lg" 
                  : "text-muted-foreground hover:bg-white/10 hover:text-white"
              )}
            >
              <Link href="/">
                <LayoutDashboard className={cn(
                  "w-5 h-5 shrink-0 transition-transform duration-300 group-hover/btn:scale-110",
                  pathname === "/" ? "text-primary-foreground" : "text-primary/70"
                )} />
                {!isCollapsed && <span className="font-medium">Overview</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <div className="my-4 px-2">
            {!isCollapsed && (
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground/40">
                Departments
              </span>
            )}
            <div className="h-px bg-white/5 mt-2" />
          </div>

          {departments.map((dept) => {
            const isActive = dept.items.some(i => i.href === pathname);
            return (
              <Collapsible key={dept.title} asChild defaultOpen={isActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      tooltip={dept.title}
                      className={cn(
                        "h-12 rounded-xl text-muted-foreground hover:bg-white/10 hover:text-white transition-all duration-300 group-data-[state=open]/collapsible:bg-white/5",
                        isActive && "text-primary bg-primary/5"
                      )}
                    >
                      <dept.icon className={cn(
                        "w-5 h-5 shrink-0 transition-colors duration-300",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
                      )} />
                      {!isCollapsed && (
                        <>
                          <span className="font-medium ml-2">{dept.title}</span>
                          <ChevronRight className={cn(
                            "ml-auto w-4 h-4 transition-transform duration-500 ease-in-out opacity-40 group-hover:opacity-100",
                            "group-data-[state=open]/collapsible:rotate-90 group-data-[state=open]/collapsible:opacity-100"
                          )} />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="animate-in fade-in-0 slide-in-from-top-1 duration-300">
                    <SidebarMenuSub className="border-l border-white/5 ml-6 mt-1 gap-1">
                      {dept.items.map((item) => (
                        <SidebarMenuSubItem key={item.name}>
                          <SidebarMenuSubButton 
                            asChild 
                            isActive={pathname === item.href}
                            className={cn(
                              "rounded-lg transition-all duration-200 h-9 relative overflow-hidden group/subitem",
                              pathname === item.href 
                                ? "text-primary bg-primary/10 font-bold" 
                                : "text-muted-foreground hover:text-white hover:bg-white/5"
                            )}
                          >
                            <Link href={item.href || "#"}>
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full mr-2 transition-all duration-300",
                                pathname === item.href 
                                  ? "bg-primary scale-100 shadow-[0_0_8px_rgba(var(--primary),0.8)]" 
                                  : "bg-white/10 scale-50 group-hover/subitem:scale-75 group-hover/subitem:bg-white/30"
                              )} />
                              <span>{item.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-white/5 mt-auto bg-black/40 backdrop-blur-xl">
        <SidebarMenu className="gap-2">
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="text-muted-foreground hover:text-white hover:bg-destructive/10 hover:text-destructive h-11 rounded-xl transition-all duration-300 group/logout"
              onClick={() => signOut(auth)}
            >
              <LogOut className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover/logout:-translate-x-1" />
              {!isCollapsed && <span className="font-medium">Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="mt-2">
            <div className={cn(
              "flex items-center gap-3 transition-all duration-500 p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 group/user",
              isCollapsed ? "justify-center" : "px-3"
            )}>
              <Avatar className="w-10 h-10 border border-white/10 shadow-inner shrink-0 ring-2 ring-transparent group-hover/user:ring-primary/20 transition-all duration-500">
                <AvatarImage src={user?.photoURL || defaultAvatar} alt="User Profile" />
                <AvatarFallback className="bg-gradient-to-tr from-secondary to-primary/50 text-white text-xs font-bold">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate text-white/90">
                    {user?.displayName || "Bar Staff"}
                  </span>
                  <span className="text-[10px] text-primary/70 truncate uppercase tracking-[0.2em] font-bold">
                    {user?.email || "Manager"}
                  </span>
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-900 via-background to-black w-full flex-col md:flex-row">
        
        {/* Mobile Navbar */}
        <header className="md:hidden flex items-center justify-between h-20 px-6 border-b border-white/5 bg-background/30 backdrop-blur-2xl sticky top-0 z-[60]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
              <img src={LOGO_URL} alt="NMCH Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-headline font-bold text-xl tracking-tighter text-white">NMCH</span>
          </div>
          <Button variant="ghost" size="icon" className="text-white" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </header>

        {/* Mobile Dropdown Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-x-0 top-20 bottom-0 bg-background/95 backdrop-blur-3xl z-50 overflow-y-auto animate-in slide-in-from-top duration-300">
            <nav className="p-6 space-y-6">
              <Link 
                href="/" 
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl font-bold transition-all",
                  pathname === "/" ? "bg-primary text-primary-foreground" : "text-white/70 hover:bg-white/5"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <LayoutDashboard className="w-5 h-5" /> Overview
              </Link>

              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground/40 px-4">Departments</p>
                {departments.map((dept) => (
                  <div key={dept.title} className="space-y-2">
                    <div className="flex items-center gap-3 px-4 py-2 text-primary font-bold text-sm">
                      <dept.icon className="w-4 h-4" /> {dept.title}
                    </div>
                    <div className="grid grid-cols-1 gap-1 ml-4 border-l border-white/10 pl-4">
                      {dept.items.map((item) => (
                        <Link
                          key={item.name}
                          href={item.href || "#"}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg text-sm transition-all",
                            pathname === item.href ? "text-primary bg-primary/10 font-bold" : "text-white/60 hover:text-white"
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-white/5">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 h-12 rounded-xl"
                  onClick={() => {
                    signOut(auth);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="w-5 h-5" /> Sign Out
                </Button>
              </div>
            </nav>
          </div>
        )}

        <div className="hidden md:block">
          <AppSidebar />
        </div>
        
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <header className="hidden md:flex items-center h-20 px-10 border-b border-white/5 bg-background/30 backdrop-blur-xl sticky top-0 z-20">
            <SidebarTrigger className="mr-6 text-muted-foreground hover:text-primary transition-all duration-300 scale-110" />
            <div className="flex items-center gap-3 mr-auto">
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 scroll-smooth">
            <div className="max-w-7xl mx-auto w-full no-print">
              {children}
            </div>
            {/* Print area placeholder for Duckets */}
            <div id="print-area" className="print-only" />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
