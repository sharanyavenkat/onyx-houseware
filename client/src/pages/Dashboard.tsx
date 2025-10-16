import DashboardCards from '../components/DashboardCards';
import DataTable from '../components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item, Order, Customer } from '@shared/schema';
import { calculateInventoryMetrics } from '@shared/inventory';

// Extended Order type with line_items from API
type OrderWithLineItems = Order & {
  line_items?: Array<{
    item_id: number;
    item_name: string;
    sku: string;
    quantity: number;
  }>;
};

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
  const [selectedMonth, setSelectedMonth] = useState('all');

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  const { data: orders = [] } = useQuery<OrderWithLineItems[]>({
    queryKey: ['/api/orders'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  // Extract unique months from orders based on fulfillment_date
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach(order => {
      if (order.fulfillment_date) {
        const date = new Date(order.fulfillment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  // Filter orders by selected month (based on fulfillment_date)
  const filteredOrders = useMemo(() => {
    if (selectedMonth === 'all') return orders;
    
    return orders.filter(order => {
      if (!order.fulfillment_date) return false;
      const date = new Date(order.fulfillment_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === selectedMonth;
    });
  }, [orders, selectedMonth]);

  const dashboardData = {
    totalOrders: filteredOrders.length,
    pendingOrders: filteredOrders.filter(o => o.status === 'draft' || o.status === 'confirmed').length,
    totalItems: items.filter(item => item.is_active).length,
    totalCustomers: customers.length
  };

  // Calculate top items by pending quantity from real order data
  const topItemsByPendingQty = useMemo(() => {
    const itemPendingQtyMap = new Map<number, { name: string; pendingQty: number; safetyStock: number }>();
    
    // Aggregate pending quantities from filtered orders
    filteredOrders
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
    
    // Convert to array, calculate status using shared utility (assuming opening=0, expected=0 for worst case)
    return Array.from(itemPendingQtyMap.values())
      .map(item => {
        // Use shared calculation with opening=0, expected=0 (worst case for dashboard view)
        const metrics = calculateInventoryMetrics(0, 0, item.pendingQty, item.safetyStock);
        return {
          ...item,
          status: metrics.safetyStockStatus === 'critical' ? 'Critical' 
                : metrics.safetyStockStatus === 'low' ? 'Low' 
                : 'Good'
        };
      })
      .sort((a, b) => b.pendingQty - a.pendingQty)
      .slice(0, 5);
  }, [filteredOrders, items]);

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your order management system</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by Fulfillment Month:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter-month">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {availableMonths.map(month => {
                const [year, monthNum] = month.split('-');
                const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('default', { month: 'long' });
                return (
                  <SelectItem key={month} value={month}>
                    {monthName} {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards */}
      <DashboardCards data={dashboardData} />

      {/* Top Items by Pending Quantity */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Top Items by Pending Quantity</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pending Quantity = Total from Draft or Confirmed orders. Safety stock can be used to fulfill orders - status shows concern if depleted (assumes worst-case: no opening/expected stock).
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Status Legend:</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Badge variant="destructive" data-testid="badge-legend-critical">Critical</Badge>
                  <span className="text-xs text-muted-foreground">Stock after pending &lt; 50% of safety or negative</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" data-testid="badge-legend-low">Low</Badge>
                  <span className="text-xs text-muted-foreground">Stock after pending &lt; safety stock</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="default" data-testid="badge-legend-good">Good</Badge>
                  <span className="text-xs text-muted-foreground">Stock after pending ≥ safety stock</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <DataTable 
          columns={topItemsColumns}
          data={topItemsByPendingQty}
          title=""
          searchable={false}
        />
      </div>
    </div>
  );
}