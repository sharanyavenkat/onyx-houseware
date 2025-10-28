import DashboardCards from '../components/DashboardCards';
import DataTable from '../components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item, Order, Customer, Indent } from '@shared/schema';
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
  { key: 'pendingQty', label: 'Pending Orders' },
  { key: 'workingStock', label: 'Total Available' },
  { key: 'shortfall', label: 'Still Need to Order' },
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
  // Default to current month for indent data
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
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

  // Fetch indent data for current month to get real stock levels
  const { data: indents = [] } = useQuery<Indent[]>({
    queryKey: ['/api/indents', currentMonth],
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

  // Calculate top items by pending quantity using REAL indent data
  const topItemsByPendingQty = useMemo(() => {
    const itemPendingQtyMap = new Map<number, { name: string; pendingQty: number; safetyStock: number }>();
    
    // Aggregate pending quantities from ALL orders (not filtered by month - we want all pending orders)
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
    
    // Convert to array, calculate using REAL indent data
    return Array.from(itemPendingQtyMap.values())
      .map(itemData => {
        const item = items.find(i => i.name === itemData.name);
        if (!item) return null;
        
        // Get real indent data for this item (current month)
        const indent = indents.find(i => i.item_id === item.id);
        const openingBalance = indent?.opening_balance ?? 0;
        const expectedReceipts = indent?.expected_receipts ?? 0;
        
        // Calculate using REAL numbers from indent
        const metrics = calculateInventoryMetrics(
          openingBalance,
          expectedReceipts,
          itemData.pendingQty,
          itemData.safetyStock
        );
        
        return {
          name: itemData.name,
          pendingQty: itemData.pendingQty,
          workingStock: metrics.workingStock + metrics.safetyStock, // Total available
          shortfall: metrics.shortfallToFulfill, // Only what's needed to fulfill orders
          status: metrics.safetyStockStatus === 'critical' ? 'Critical' 
                : metrics.safetyStockStatus === 'low' ? 'Low' 
                : 'Good'
        };
      })
      .filter(item => item !== null)
      .sort((a, b) => b.shortfall - a.shortfall)
      .slice(0, 5);
  }, [orders, items, indents]);

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

      {/* Items Requiring Attention */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div>
            <h2 className="text-xl font-semibold">Items Requiring Attention</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Shows items with pending orders using current month's indent data (Opening Balance + Expected Receipts + Safety Stock). 
              "Still Need to Order" shows the shortfall to fulfill pending orders after using all available stock. Visit Indent page for detailed planning.
            </p>
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