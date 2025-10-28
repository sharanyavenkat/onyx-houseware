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
  const [editingCells, setEditingCells] = useState<Record<string, number>>({});
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
      const openingBalance = editingCells[`${item.id}-opening_balance`] ?? indent?.opening_balance ?? 0;
      const expectedReceipts = editingCells[`${item.id}-expected_receipts`] ?? indent?.expected_receipts ?? 0;
      const safetyStock = editingCells[`${item.id}-safety_stock`] ?? item.safety_stock;
      const pendingQty = pendingOrdersByItem[item.id] || 0;
      
      // Use shared inventory calculation
      const metrics = calculateInventoryMetrics(
        openingBalance,
        expectedReceipts,
        pendingQty,
        safetyStock
      );

      return {
        id: item.id,
        item_name: item.name,
        opening_balance: openingBalance,
        expected_receipts: expectedReceipts,
        safety_stock: safetyStock,
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
    mutationFn: async (data: { item_id: number; month: string; opening_balance: number; expected_receipts: number }[]) => {
      console.log('[Indent Auto-Save] Saving indents:', JSON.stringify(data, null, 2));
      await Promise.all(
        data.map(indent => {
          console.log('[Indent Auto-Save] POST /api/indents with payload:', indent);
          return apiRequest('POST', '/api/indents', indent);
        })
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/indents', selectedMonth] });
      
      // Clear editing cells only for successfully saved items (indent fields)
      setEditingCells(prev => {
        const updated = { ...prev };
        variables.forEach(item => {
          delete updated[`${item.item_id}-opening_balance`];
          delete updated[`${item.item_id}-expected_receipts`];
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

  // Save mutation for item safety stock
  const saveItemMutation = useMutation({
    mutationFn: async (data: { id: number; safety_stock: number }[]) => {
      await Promise.all(
        data.map(item => apiRequest('PATCH', `/api/items/${item.id}`, { safety_stock: item.safety_stock }))
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      
      // Clear editing cells only for successfully saved items (safety stock field)
      setEditingCells(prev => {
        const updated = { ...prev };
        variables.forEach(item => {
          delete updated[`${item.id}-safety_stock`];
        });
        return updated;
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating safety stock', description: error.message, variant: 'destructive' });
    },
  });

  // Auto-save with debouncing
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Check if there are any safety stock edits pending
    const hasSafetyStockEdits = Object.keys(editingCells).some(key => key.endsWith('-safety_stock'));

    // Don't save if nothing has been edited
    if (dirtyItems.size === 0 && !hasSafetyStockEdits) {
      return;
    }

    // Set new timeout for auto-save (1 second debounce)
    saveTimeoutRef.current = setTimeout(() => {
      // Prepare indent data ONLY for dirty items
      const indentsToSave = indentData
        .filter(row => dirtyItems.has(row.id))
        .map(row => ({
          item_id: row.id,
          month: selectedMonth,
          opening_balance: row.opening_balance,
          expected_receipts: row.expected_receipts,
        }));

      // Prepare safety stock updates (only for items that have changed safety stock)
      const itemsToUpdate: { id: number; safety_stock: number }[] = [];
      Object.keys(editingCells).forEach(key => {
        if (key.endsWith('-safety_stock')) {
          const itemId = parseInt(key.split('-')[0]);
          const newSafetyStock = editingCells[key];
          const originalItem = items.find(i => i.id === itemId);
          
          // Only update if safety stock actually changed
          if (originalItem && originalItem.safety_stock !== newSafetyStock) {
            itemsToUpdate.push({ id: itemId, safety_stock: newSafetyStock });
          }
        }
      });

      // Save indent data (only for dirty items)
      if (indentsToSave.length > 0) {
        saveIndentMutation.mutate(indentsToSave);
      }

      // Save safety stock updates
      if (itemsToUpdate.length > 0) {
        saveItemMutation.mutate(itemsToUpdate);
      }
    }, 1000);

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [dirtyItems, editingCells, indentData, selectedMonth, items]);

  const handleCellEdit = (itemId: number, field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const key = `${itemId}-${field}`;
    setEditingCells(prev => ({ ...prev, [key]: numValue }));
    
    // Mark this item as dirty if it's an indent field
    if (field === 'opening_balance' || field === 'expected_receipts') {
      setDirtyItems(prev => new Set(prev).add(itemId));
    }
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
    { 
      key: 'safety_stock', 
      label: 'Safety Stock',
      render: (value: number, row: any) => (
        <Input
          type="number"
          value={value}
          onChange={(e) => handleCellEdit(row.id, 'safety_stock', e.target.value)}
          className="w-24"
          data-testid={`input-safety-stock-${row.id}`}
        />
      )
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
            <p className="pt-2"><strong>Required to Order</strong> = Shortfall to Fulfill + Shortfall to Restore Safety</p>
            <p className="text-xs pl-4">• Shortfall to Fulfill = max(0, Pending - Usable Stock) <span className="text-muted-foreground/70">(shortfall to complete pending orders)</span></p>
            <p className="text-xs pl-4">• Shortfall to Restore Safety = max(0, Safety Stock - max(0, Stock After Pending)) <span className="text-muted-foreground/70">(amount needed to refill safety buffer)</span></p>
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-2">Editable Safety Stock:</h3>
          <p className="text-sm text-muted-foreground">
            Safety Stock is editable here to reflect current production reality. Adjust based on bottlenecks from casters, production capacity, 
            and demand. Target is 500 pcs per item, but start lower as needed. Changes sync to the Items table automatically.
          </p>
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
