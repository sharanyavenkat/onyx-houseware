import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Users, FileText, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

interface DashboardCardsProps {
  data?: {
    totalOrders: number;
    pendingOrders: number;
    totalItems: number;
    totalCustomers: number;
  };
}

// TODO: Remove mock data functionality
const mockData = {
  totalOrders: 47,
  pendingOrders: 12,
  totalItems: 156,
  totalCustomers: 23
};

export default function DashboardCards({ data = mockData }: DashboardCardsProps) {
  const [, setLocation] = useLocation();

  const cards = [
    {
      title: "Total Orders",
      value: data.totalOrders,
      icon: FileText,
      description: "This month",
      trend: "+12%",
      onClick: () => setLocation('/orders')
    },
    {
      title: "Pending Orders",
      value: data.pendingOrders,
      icon: TrendingUp,
      description: "Needs attention",
      trend: "+3",
      onClick: () => setLocation('/orders?filter=pending')
    },
    {
      title: "Total Items",
      value: data.totalItems,
      icon: Package,
      description: "In inventory",
      trend: "+8",
      onClick: () => setLocation('/items')
    },
    {
      title: "Total Customers",
      value: data.totalCustomers,
      icon: Users,
      description: "Active customers",
      trend: "+2",
      onClick: () => setLocation('/customers')
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card 
          key={index} 
          className="hover-elevate cursor-pointer" 
          onClick={card.onClick}
          data-testid={`card-${card.title.toLowerCase().replace(' ', '-')}`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid={`text-${card.title.toLowerCase().replace(' ', '-')}-value`}>
              {card.value}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
              <Badge variant="secondary" className="text-xs">
                {card.trend}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}