import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";

// Import pages
import Dashboard from "@/pages/Dashboard";
import Items from "@/pages/Items";
import Customers from "@/pages/Customers";
import Orders from "@/pages/Orders";
import OrderDetails from "@/pages/OrderDetails";
import Indent from "@/pages/Indent";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/Sidebar";

function AuthenticatedApp() {
  return (
    <div className="flex h-screen bg-background" data-testid="app-authenticated">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/items" component={Items} />
            <Route path="/customers" component={Customers} />
            <Route path="/orders" component={Orders} />
            <Route path="/orders/:id" component={OrderDetails} />
            <Route path="/indent" component={Indent} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  // TODO: Replace with actual authentication state management
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Set to false for login demo

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isAuthenticated ? (
          <AuthenticatedApp />
        ) : (
          <Login />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
