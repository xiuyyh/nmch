
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
  LogOut,
  ChevronRight,
  Wine,
  Warehouse,
  UtensilsCrossed,
  Contact,
  Sparkles
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
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";

const LOGO_URL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQw8oatrplLFy0o-ghLuTFtu1gKQqYtgfXw0A&s";

const departments = [
  {
    title: "Bar",
    icon: Wine,
    items: [
      { name: "POS / Quick Sale", href: "/pos", icon: ShoppingCart },
      { name: "Inventory", href: "/inventory", icon: Package },
      { name: "Menu Config", href: "/menu", icon: MenuIcon },
      { name: "Sales Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Store",
    icon: Warehouse,
    items: [
      { name: "Stock Requests", href: "/requests", icon: ClipboardList },
      { name: "Warehouse Stock", href: "/store/warehouse" },
      { name: "Suppliers", href: "/store/suppliers" },
    ],
  },
  {
    title: "Kitchen",
    icon: UtensilsCrossed,
    items: [
      { name: "Active Orders", href: "/kitchen/orders" },
      { name: "Recipe Book", href: "/kitchen/recipes" },
      { name: "Prep List", href: "/kitchen/prep" },
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
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-background/50 backdrop-blur-2xl">
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
          {/* Dashboard Link (Flat) */}
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={pathname === "/"}
              tooltip="Overview"
              className={cn(
                "transition-all duration-300 h-11 rounded-xl",
                pathname === "/" 
                  ? "bg-primary text-primary-foreground neon-glow-primary" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              )}
            >
              <Link href="/">
                <LayoutDashboard className="w-5 h-5" />
                <span className="font-medium">Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Department Sections (Collapsible) */}
          {departments.map((dept) => (
            <Collapsible key={dept.title} asChild defaultOpen={dept.items.some(i => i.href === pathname)} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton 
                    tooltip={dept.title}
                    className="h-11 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-white group-data-[state=open]/collapsible:text-primary"
                  >
                    <dept.icon className="w-5 h-5" />
                    <span className="font-medium">{dept.title}</span>
                    <ChevronRight className="ml-auto w-4 h-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="border-l border-white/5 ml-4 mt-1 gap-1">
                    {dept.items.map((item) => (
                      <SidebarMenuSubItem key={item.name}>
                        <SidebarMenuSubButton 
                          asChild 
                          isActive={pathname === item.href}
                          className={cn(
                            "rounded-lg transition-all duration-200",
                            pathname === item.href 
                              ? "text-primary bg-primary/10" 
                              : "text-muted-foreground hover:text-white"
                          )}
                        >
                          <Link href={item.href}>
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-white/5 mt-auto bg-black/20">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="text-muted-foreground hover:text-white hover:bg-white/5 h-11 rounded-xl transition-all duration-300"
              onClick={() => signOut(auth)}
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="mt-2">
            <div className={cn(
              "flex items-center gap-3 transition-all duration-500 p-2 rounded-2xl bg-white/5 border border-white/5",
              isCollapsed ? "justify-center" : "px-3"
            )}>
              <Avatar className="w-9 h-9 border border-white/10 shadow-inner shrink-0">
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
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-900 via-background to-black w-full">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <header className="flex items-center h-20 px-4 md:px-10 border-b border-white/5 bg-background/30 backdrop-blur-xl sticky top-0 z-20">
            <SidebarTrigger className="mr-6 text-muted-foreground hover:text-primary transition-all duration-300 scale-110" />
            <div className="md:hidden flex items-center gap-2 mr-auto">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/30">
                <img src={LOGO_URL} alt="NMCH Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-headline font-bold text-xl tracking-tighter">NMCH</span>
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
