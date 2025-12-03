import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { 
  Home, 
  Package, 
  Users, 
  FileText, 
  ClipboardList,
  LogOut,
  Menu,
  Box,
  Wrench
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SidebarProps {
  className?: string;
}

const menuItems = [
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: FileText, label: "Orders", href: "/orders" },
  { icon: Box, label: "Batches", href: "/batches" },
  { icon: ClipboardList, label: "Indent", href: "/indent" },
  { icon: Package, label: "Items", href: "/items" },
  { icon: Wrench, label: "Accessories", href: "/accessories" },
  { icon: Users, label: "Customers", href: "/customers" },
];

function NavigationContent({ 
  location, 
  onNavigate, 
  onLogout,
  isLoggingOut 
}: { 
  location: string; 
  onNavigate?: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}) {
  return (
    <>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start hover-elevate"
                onClick={onNavigate}
                data-testid={`link-${item.label.toLowerCase()}`}
              >
                <item.icon className="h-4 w-4" />
                <span className="ml-3">{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full justify-start hover-elevate text-destructive hover:text-destructive"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="ml-3">{isLoggingOut ? "Logging out..." : "Logout"}</span>
        </Button>
      </div>
    </>
  );
}

export default function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [location] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const closeMobileMenu = () => {
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(true)}
          className="hover-elevate"
          data-testid="button-mobile-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-sidebar-foreground ml-3">Onyx Houseware</h1>
      </div>

      {/* Mobile Sheet/Drawer */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar flex flex-col">
          <SheetHeader className="p-4 border-b border-sidebar-border">
            <SheetTitle className="text-lg font-semibold text-sidebar-foreground text-left">
              Onyx Houseware
            </SheetTitle>
            <SheetDescription className="sr-only">
              Navigation menu
            </SheetDescription>
          </SheetHeader>
          <NavigationContent 
            location={location} 
            onNavigate={closeMobileMenu}
            onLogout={handleLogout}
            isLoggingOut={logoutMutation.isPending}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - Hidden on mobile */}
      <div className={cn(
        "hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {!isCollapsed && (
            <h1 className="text-lg font-semibold text-sidebar-foreground">Onyx Houseware</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hover-elevate"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start hover-elevate",
                    isCollapsed && "justify-center px-2"
                  )}
                  data-testid={`link-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {!isCollapsed && <span className="ml-3">{item.label}</span>}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className={cn(
              "w-full justify-start hover-elevate text-destructive hover:text-destructive",
              isCollapsed && "justify-center px-2"
            )}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-3">
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </span>}
          </Button>
        </div>
      </div>
    </>
  );
}
