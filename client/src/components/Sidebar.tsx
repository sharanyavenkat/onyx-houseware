import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Package, 
  Users, 
  FileText, 
  ClipboardList,
  LogOut,
  Menu,
  Sun,
  Moon
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

interface SidebarProps {
  className?: string;
}

const menuItems = [
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: Package, label: "Items", href: "/items" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: FileText, label: "Orders", href: "/orders" },
  { icon: ClipboardList, label: "Indent", href: "/indent" },
];

export default function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [location] = useLocation();

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
    console.log('Theme toggled');
  };

  const handleLogout = () => {
    console.log('Logout triggered');
    // TODO: Implement actual logout
  };

  return (
    <div className={cn(
      "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
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
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          onClick={toggleTheme}
          className={cn(
            "w-full justify-start hover-elevate",
            isCollapsed && "justify-center px-2"
          )}
          data-testid="button-theme-toggle"
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!isCollapsed && <span className="ml-3">Toggle Theme</span>}
        </Button>
        
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start hover-elevate text-destructive hover:text-destructive",
            isCollapsed && "justify-center px-2"
          )}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </div>
  );
}