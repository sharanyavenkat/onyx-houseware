import DataTable from '../components/DataTable';
import MonthPicker from '../components/MonthPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Item, Indent, Order, OrderItem } from '@shared/schema';
import { calculateInventoryMetrics } from '@shared/inventory';

export default function IndentPage() {
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editingCells, setEditingCells] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Fetch all items
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  // Fetch indents for selected month
  const { data: indents = [] } = useQuery<Indent[]>({
    queryKey: ['/api/indents', selectedMonth],
  });

  // Fetch all orders
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  // Fetch all order items
  const { data: allOrderItems = [] } = useQuery<OrderItem[]>({
    queryKey: ['/api/order-items'],
  });

  // Calculate pending orders per item
  const pendingOrdersByItem = useMemo(() => {
    const pending: Record<number, number> = {};
    
    // Filter orders by draft or confirmed status
    const activeOrders = orders.filter(o => o.status === 'draft' || o.status === 'confirmed');
    const activeOrderIds = new Set(activeOrders.map(o => o.id));
    
    // Sum quantities for each item from active orders
    allOrderItems.forEach(oi => {
      if (activeOrderIds.has(oi.order_id)) {
        pending[oi.item_id] = (pending[oi.item_id] || 0) + oi.quantity;
      }
    });
    
    return pending;
  }, [orders, allOrderItems]);

  // Merge data
  const indentData = useMemo(() => {
    return items.map(item => {
      const indent = indents.find(i => i.item_id === item.id);
      const openingBalance = editingCells[`${item.id}-opening_balance`] ?? indent?.opening_balance ?? 0;
      const expectedReceipts = editingCells[`${item.id}-expected_receipts`] ?? indent?.expected_receipts ?? 0;
      const pendingQty = pendingOrdersByItem[item.id] || 0;
      
      // Use shared inventory calculation
      const metrics = calculateInventoryMetrics(
        openingBalance,
        expectedReceipts,
        pendingQty,
        item.safety_stock
      );

      return {
        id: item.id,
        item_name: item.name,
        opening_balance: openingBalance,
        expected_receipts: expectedReceipts,
        pending_order_qty: pendingQty,
        safety_stock: item.safety_stock,
        working_stock: metrics.workingStock,
        usable_stock: metrics.usableStock,
        post_pending_stock: metrics.postPendingStock,
        safety_stock_status: metrics.safetyStockStatus,
        shortfall_to_fulfill: metrics.shortfallToFulfill,
        shortfall_to_restore_safety: metrics.shortfallToRestoreSafety,
        required_to_order: metrics.totalRequired,
        needs_safety_refill: metrics.shortfallToRestoreSafety > 0,
        is_safety_buffer_breached: metrics.isSafetyBufferBreached,
      };
    });
  }, [items, indents, pendingOrdersByItem, editingCells]);

  const saveMutation = useMutation({
    mutationFn: async (data: { item_id: number; month: string; opening_balance: number; expected_receipts: number }[]) => {
      await Promise.all(
        data.map(indent => apiRequest('POST', '/api/indents', indent))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indents', selectedMonth] });
      toast({ title: 'Indent saved successfully' });
      setEditingCells({});
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving indent', description: error.message, variant: 'destructive' });
    },
  });

  const handleCellEdit = (itemId: number, field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const key = `${itemId}-${field}`;
    setEditingCells(prev => ({ ...prev, [key]: numValue }));
  };

  const handleSave = () => {
    const indentsToSave = indentData.map(row => ({
      item_id: row.id,
      month: selectedMonth,
      opening_balance: row.opening_balance,
      expected_receipts: row.expected_receipts,
    }));
    saveMutation.mutate(indentsToSave);
  };

  const indentColumns = [
    { key: 'item_name', label: 'Item Name' },
    { 
      key: 'opening_balance', 
      label: 'Opening Balance', 
      render: (value: number, row: any) => (
        <Input
          type="number"
          value={value}
          onChange={(e) => handleCellEdit(row.id, 'opening_balance', e.target.value)}
          className="w-24"
          data-testid={`input-opening-balance-${row.id}`}
        />
      )
    },
    { 
      key: 'expected_receipts', 
      label: 'Expected Receipts', 
      render: (value: number, row: any) => (
        <Input
          type="number"
          value={value}
          onChange={(e) => handleCellEdit(row.id, 'expected_receipts', e.target.value)}
          className="w-24"
          data-testid={`input-expected-receipts-${row.id}`}
        />
      )
    },
    { key: 'pending_order_qty', label: 'Pending Orders' },
    { key: 'safety_stock', label: 'Safety Stock' },
    { 
      key: 'usable_stock', 
      label: 'Total Usable Stock',
      render: (value: number, row: any) => (
        <span className="font-medium" data-testid={`text-usable-stock-${row.id}`}>
          {value}
        </span>
      )
    },
    { 
      key: 'post_pending_stock', 
      label: 'Stock After Pending',
      render: (value: number, row: any) => (
        <span className={`font-medium ${value < 0 ? 'text-destructive' : ''}`} data-testid={`text-post-pending-${row.id}`}>
          {value}
        </span>
      )
    },
    { 
      key: 'safety_stock_status', 
      label: 'Safety Stock Status', 
      render: (value: string, row: any) => {
        if (value === 'critical') {
          return <Badge variant="destructive" data-testid={`badge-status-critical-${row.id}`}>Critical</Badge>;
        } else if (value === 'low') {
          return <Badge variant="secondary" data-testid={`badge-status-low-${row.id}`}>Low</Badge>;
        } else {
          return <Badge variant="default" data-testid={`badge-status-good-${row.id}`}>Good</Badge>;
        }
      }
    },
    { 
      key: 'required_to_order', 
      label: 'Required to Order', 
      render: (value: number, row: any) => (
        <div className="space-y-1">
          <span className={`font-semibold block ${value > 0 ? 'text-destructive' : 'text-muted-foreground'}`} data-testid={`text-required-${row.id}`}>
            {value}
          </span>
          {row.needs_safety_refill && (
            <Badge variant="outline" className="text-xs" data-testid={`badge-refill-needed-${row.id}`}>
              Refill Needed
            </Badge>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6" data-testid="page-indent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-indent-title">Indent Management</h1>
          <p className="text-muted-foreground">Manage monthly inventory requirements</p>
        </div>
        <div className="flex items-center gap-4">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-indent">
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Formula Explanation */}
      <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
        <div>
          <h3 className="font-medium mb-2">Two-Tier Inventory Model:</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Working Stock</strong> = Opening Balance + Expected Receipts <span className="text-xs">(normal operational inventory)</span></p>
            <p><strong>Total Usable Stock</strong> = Working Stock + Safety Stock <span className="text-xs">(safety stock can be used to fulfill orders)</span></p>
            <p><strong>Stock After Pending</strong> = Total Usable Stock - Pending Orders <span className="text-xs">(remaining after using all available stock)</span></p>
            <p className="pt-2"><strong>Required to Order</strong> = Shortfall to Fulfill + Shortfall to Restore Safety</p>
            <p className="text-xs pl-4">• Shortfall to Fulfill = max(0, Pending - Usable Stock) <span className="text-muted-foreground/70">(shortfall to complete pending orders)</span></p>
            <p className="text-xs pl-4">• Shortfall to Restore Safety = max(0, Safety Stock - max(0, Stock After Pending)) <span className="text-muted-foreground/70">(amount needed to refill safety buffer)</span></p>
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-2">Safety Stock Status & Concerns:</h3>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" data-testid="badge-legend-critical">Critical</Badge>
              <span className="text-muted-foreground">Stock after pending &lt; 50% of safety stock or negative</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" data-testid="badge-legend-low">Low</Badge>
              <span className="text-muted-foreground">Stock after pending &lt; safety stock</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" data-testid="badge-legend-good">Good</Badge>
              <span className="text-muted-foreground">Stock after pending ≥ safety stock</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Refill Needed</Badge>
              <span className="text-muted-foreground">Safety stock needs refilling</span>
            </div>
          </div>
        </div>
      </div>

      {/* Indent Table */}
      <DataTable 
        columns={indentColumns}
        data={indentData}
        title="Monthly Indent Report"
        searchable={false}
      />
    </div>
  );
}
