import DataTable from '../components/DataTable';
import MonthPicker from '../components/MonthPicker';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Item, Indent, Order, OrderItem } from '@shared/schema';
import { calculateInventoryMetrics } from '@shared/inventory';

export default function IndentPage() {
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});
  const [dirtyItems, setDirtyItems] = useState<Set<number>>(new Set());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Fetch all items (only active items)
  const { data: allItems = [] } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  // Filter to only active items
  const items = useMemo(() => allItems.filter(item => item.is_active), [allItems]);

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
      const openingBalance = editingCells[`${item.id}-opening_balance`] !== undefined ? parseInt(editingCells[`${item.id}-opening_balance`]) || 0 : indent?.opening_balance ?? 0;
      const expectedReceipts = editingCells[`${item.id}-expected_receipts`] !== undefined ? parseInt(editingCells[`${item.id}-expected_receipts`]) || 0 : indent?.expected_receipts ?? 0;
      // Current safety stock: Use indent value if exists, otherwise default to 0
      const currentSafetyStock = editingCells[`${item.id}-current_safety_stock`] !== undefined ? parseInt(editingCells[`${item.id}-current_safety_stock`]) || 0 : indent?.current_safety_stock ?? 0;
      const pendingQty = pendingOrdersByItem[item.id] || 0;
      
      // Use shared inventory calculation with both current and desired safety stock
      const metrics = calculateInventoryMetrics(
        openingBalance,
        expectedReceipts,
        pendingQty,
        currentSafetyStock,
        item.desired_safety_stock
      );

      return {
        id: item.id,
        item_name: item.name,
        opening_balance: openingBalance,
        expected_receipts: expectedReceipts,
        desired_safety_stock: item.desired_safety_stock,
        current_safety_stock: currentSafetyStock,
        pending_order_qty: pendingQty,
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

  // Save mutation for indent data
  const saveIndentMutation = useMutation({
    mutationFn: async (data: { item_id: number; month: string; opening_balance: number; expected_receipts: number; current_safety_stock: number }[]) => {
      await Promise.all(
        data.map(indent => apiRequest('POST', '/api/indents', indent))
      );
    },
    onSuccess: async (_, variables) => {
      // Refetch and wait for the query to complete before clearing editing state
      await queryClient.refetchQueries({ queryKey: ['/api/indents', selectedMonth] });
      
      // Clear editing cells only for successfully saved items (indent fields)
      setEditingCells(prev => {
        const updated = { ...prev };
        variables.forEach(item => {
          delete updated[`${item.item_id}-opening_balance`];
          delete updated[`${item.item_id}-expected_receipts`];
          delete updated[`${item.item_id}-current_safety_stock`];
        });
        return updated;
      });
      
      // Remove from dirty items
      setDirtyItems(prev => {
        const updated = new Set(prev);
        variables.forEach(item => updated.delete(item.item_id));
        return updated;
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving indent', description: error.message, variant: 'destructive' });
    },
  });


  // Auto-save with debouncing
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Check if there are any current_safety_stock edits pending
    const hasCurrentSafetyStockEdits = Object.keys(editingCells).some(key => key.endsWith('-current_safety_stock'));

    // Don't save if nothing has been edited
    if (dirtyItems.size === 0 && !hasCurrentSafetyStockEdits) {
      return;
    }

    // Set new timeout for auto-save (1 second debounce)
    saveTimeoutRef.current = setTimeout(() => {
      // Prepare indent data ONLY for dirty items or items with current_safety_stock changes
      const itemsWithChanges = new Set(dirtyItems);
      
      // Also include items with current_safety_stock changes
      Object.keys(editingCells).forEach(key => {
        if (key.endsWith('-current_safety_stock')) {
          const itemId = parseInt(key.split('-')[0]);
          itemsWithChanges.add(itemId);
        }
      });

      const indentsToSave = indentData
        .filter(row => itemsWithChanges.has(row.id))
        .map(row => ({
          item_id: row.id,
          month: selectedMonth,
          opening_balance: row.opening_balance,
          expected_receipts: row.expected_receipts,
          current_safety_stock: row.current_safety_stock,
        }));

      // Save indent data
      if (indentsToSave.length > 0) {
        saveIndentMutation.mutate(indentsToSave);
      }
    }, 1000);

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [dirtyItems, editingCells, indentData, selectedMonth]);

  const handleCellEdit = (itemId: number, field: string, value: string) => {
    const key = `${itemId}-${field}`;
    // Store the raw string value to avoid lag during typing
    setEditingCells(prev => ({ ...prev, [key]: value }));
    
    // Mark this item as dirty if it's an indent field (including current_safety_stock)
    if (field === 'opening_balance' || field === 'expected_receipts' || field === 'current_safety_stock') {
      setDirtyItems(prev => new Set(prev).add(itemId));
    }
  };

  const indentColumns = [
    { key: 'item_name', label: 'Item Name' },
    { 
      key: 'opening_balance', 
      label: 'Opening Balance', 
      render: (value: number, row: any) => {
        const key = `${row.id}-opening_balance`;
        const displayValue = editingCells[key] !== undefined ? editingCells[key] : String(value);
        return (
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => handleCellEdit(row.id, 'opening_balance', e.target.value)}
            className="w-24"
            data-testid={`input-opening-balance-${row.id}`}
          />
        );
      }
    },
    { 
      key: 'expected_receipts', 
      label: 'Expected Receipts', 
      render: (value: number, row: any) => {
        const key = `${row.id}-expected_receipts`;
        const displayValue = editingCells[key] !== undefined ? editingCells[key] : String(value);
        return (
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => handleCellEdit(row.id, 'expected_receipts', e.target.value)}
            className="w-24"
            data-testid={`input-expected-receipts-${row.id}`}
          />
        );
      }
    },
    { 
      key: 'desired_safety_stock', 
      label: 'Target Safety Stock',
      render: (value: number, row: any) => (
        <span className="text-muted-foreground font-mono" data-testid={`text-desired-safety-${row.id}`}>
          {value}
        </span>
      )
    },
    { 
      key: 'current_safety_stock', 
      label: 'Current Safety Stock',
      render: (value: number, row: any) => {
        const key = `${row.id}-current_safety_stock`;
        const displayValue = editingCells[key] !== undefined ? editingCells[key] : String(value);
        return (
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => handleCellEdit(row.id, 'current_safety_stock', e.target.value)}
            className="w-24"
            data-testid={`input-current-safety-${row.id}`}
          />
        );
      }
    },
    { key: 'pending_order_qty', label: 'Pending Orders' },
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
      key: 'shortfall_to_fulfill', 
      label: 'Req. to Fulfill Orders', 
      render: (value: number, row: any) => (
        <span className={`font-semibold ${value > 0 ? 'text-destructive' : 'text-muted-foreground'}`} data-testid={`text-fulfill-${row.id}`}>
          {value}
        </span>
      )
    },
    { 
      key: 'shortfall_to_restore_safety', 
      label: 'Req. for Safety Stock', 
      render: (value: number, row: any) => (
        <div className="space-y-1">
          <span className={`font-semibold block ${value > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`} data-testid={`text-safety-${row.id}`}>
            {value}
          </span>
          {row.needs_safety_refill && (
            <Badge variant="outline" className="text-xs" data-testid={`badge-refill-needed-${row.id}`}>
              Refill Needed
            </Badge>
          )}
        </div>
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
    }
  ];

  return (
    <div className="space-y-6" data-testid="page-indent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-indent-title">Indent Management</h1>
          <p className="text-muted-foreground">Manage monthly inventory requirements (auto-saves as you edit)</p>
        </div>
        <div className="flex items-center gap-4">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
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
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-2">Order Requirements (Split View):</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong className="text-destructive">Req. to Fulfill Orders</strong> = max(0, Pending - Usable Stock) <span className="text-xs">(critical - needed to complete pending orders)</span></p>
            <p><strong className="text-orange-600 dark:text-orange-400">Req. for Safety Stock</strong> = max(0, Safety Stock - max(0, Stock After Pending)) <span className="text-xs">(optional - to restore safety buffer)</span></p>
            <p className="text-xs pt-1 italic">These are split so you can decide: order just what's needed for orders, or also refill safety stock based on production capacity.</p>
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-2">Safety Stock Management:</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Target Safety Stock</strong>: Long-term desired safety stock level (set in Items page)</p>
            <p><strong>Current Safety Stock</strong>: Month-specific safety stock you can actually maintain based on production capacity, caster bottlenecks, and demand</p>
            <p className="text-xs pt-1 italic">Current safety stock defaults to target but can be adjusted monthly. All changes auto-save.</p>
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-2">Safety Stock Status Legend:</h3>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" data-testid="badge-legend-critical">Critical</Badge>
              <span className="text-muted-foreground">Stock after pending &lt; 50% of safety stock or negative</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" data-testid="badge-legend-low">Low</Badge>
              <span className="text-muted-foreground">Stock after pending &lt; safety stock but ≥ 50%</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" data-testid="badge-legend-good">Good</Badge>
              <span className="text-muted-foreground">Stock after pending ≥ safety stock</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Refill Needed</Badge>
              <span className="text-muted-foreground">Appears when safety stock needs refilling</span>
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
