import DashboardCards from '../components/DashboardCards';
import DataTable from '../components/DataTable';
import MonthPicker from '../components/MonthPicker';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item, Order, Customer } from '@shared/schema';

// Extended Order type with line_items from API
type OrderWithLineItems = Order & {
  line_items?: Array<{
    item_id: number;
    item_name: string;
    sku: string;
    quantity: number;
  }>;
};

// Function to calculate status based on pending quantity vs safety stock
function calculateStatus(pendingQty: number, safetyStock: number): string {
  if (safetyStock === 0) return 'Good';
  const ratio = pendingQty / safetyStock;
  if (ratio >= 2) return 'Critical';
  if (ratio >= 1.5) return 'Low';
  return 'Good';
}

const topItemsColumns = [
  { key: 'name', label: 'Item Name' },
  { key: 'pendingQty', label: 'Pending Qty' },
  { key: 'safetyStock', label: 'Safety Stock' },
  { 
    key: 'status', 
    label: 'Status', 
    render: (value: string) => {
      const variant = value === 'Critical' ? 'destructive' : value === 'Low' ? 'secondary' : 'default';
      return <Badge variant={variant}>{value}</Badge>;
    }
  }
];

export default function Dashboard() {
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  const { data: orders = [] } = useQuery<OrderWithLineItems[]>({
    queryKey: ['/api/orders'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const dashboardData = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'draft' || o.status === 'confirmed').length,
    totalItems: items.filter(item => item.is_active).length,
    totalCustomers: customers.length
  };

  // Calculate top items by pending quantity from real order data
  const topItemsByPendingQty = useMemo(() => {
    const itemPendingQtyMap = new Map<number, { name: string; pendingQty: number; safetyStock: number }>();
    
    // Aggregate pending quantities from orders
    orders
      .filter(order => order.status === 'draft' || order.status === 'confirmed')
      .forEach(order => {
        const lineItems = order.line_items ?? [];
        lineItems.forEach(lineItem => {
          const itemId = lineItem.item_id;
          const item = items.find(i => i.id === itemId);
          
          if (item) {
            const existing = itemPendingQtyMap.get(itemId);
            if (existing) {
              existing.pendingQty += lineItem.quantity;
            } else {
              itemPendingQtyMap.set(itemId, {
                name: item.name,
                pendingQty: lineItem.quantity,
                safetyStock: item.safety_stock || 0
              });
            }
          }
        });
      });
    
    // Convert to array, add status, sort by pending quantity, and take top 5
    return Array.from(itemPendingQtyMap.values())
      .map(item => ({
        ...item,
        status: calculateStatus(item.pendingQty, item.safetyStock)
      }))
      .sort((a, b) => b.pendingQty - a.pendingQty)
      .slice(0, 5);
  }, [orders, items]);

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your order management system</p>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Cards */}
      <DashboardCards data={dashboardData} />

      {/* Top Items by Pending Quantity */}
      <DataTable 
        columns={topItemsColumns}
        data={topItemsByPendingQty}
        title="Top Items by Pending Quantity"
        searchable={false}
      />
    </div>
  );
}