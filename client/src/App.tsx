import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Route, Switch, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";

// Import pages
import Sidebar from "@/components/Sidebar";
import Customers from "@/pages/Customers";
import Dashboard from "@/pages/Dashboard";
import Indent from "@/pages/Indent";
import Items from "@/pages/Items";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import OrderDetails from "@/pages/OrderDetails";
import Orders from "@/pages/Orders";

function AuthenticatedApp() {
  return (
    <div
      className="flex h-screen bg-background"
      data-testid="app-authenticated"
    >
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/orders" component={Orders} />
            <Route path="/orders/:id" component={OrderDetails} />
            <Route path="/indent" component={Indent} />
            <Route path="/items" component={Items} />
            <Route path="/customers" component={Customers} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return <Login />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
