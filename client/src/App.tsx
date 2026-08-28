import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Route, Switch, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";

// Import pages
import Sidebar from "@/components/Sidebar";
import Accessories from "@/pages/Accessories";
import Batches from "@/pages/Batches";
import CoatingConversions from "@/pages/CoatingConversions";
import Projections from "@/pages/Projections";
import Casters from "@/pages/Casters";
import CasterDetails from "@/pages/CasterDetails";
import Customers from "@/pages/Customers";
import Dashboard from "@/pages/Dashboard";
import Indent from "@/pages/Indent";
import Items from "@/pages/Items";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import OrderDetails from "@/pages/OrderDetails";
import Orders from "@/pages/Orders";
import Settings from "@/pages/Settings";

function AuthenticatedApp() {
  return (
    <div
      className="flex h-screen bg-background app-shell"
      data-testid="app-authenticated"
    >
      <div className="no-print">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto pt-14 md:pt-0 app-main">
        <div className="p-4 md:p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/orders" component={Orders} />
            <Route path="/orders/:id" component={OrderDetails} />
            <Route path="/indent" component={Indent} />
            <Route path="/items" component={Items} />
            <Route path="/batches" component={Batches} />
            <Route path="/coating" component={CoatingConversions} />
            <Route path="/projections" component={Projections} />
            <Route path="/casters" component={Casters} />
            <Route path="/casters/:id" component={CasterDetails} />
            <Route path="/accessories" component={Accessories} />
            <Route path="/customers" component={Customers} />
            <Route path="/settings" component={Settings} />
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
      {/* Render the Devtools component */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
