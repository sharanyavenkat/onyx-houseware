import DataTable from '../components/DataTable';
import MonthPicker from '../components/MonthPicker';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
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
  const [includeAcceptable, setIncludeAcceptable] = useState(true);
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});
  const [dirtyItems, setDirtyItems] = useState<Set<number>>(new Set());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast} = useToast();

  // Fetch all items (only active items)
  const { data: allItems = [] } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  // Filter to only active items — kits are excluded here too, since they
  // aren't castable themselves (no caster, no weight, no wastage rate).
  // Their demand should flow through to their bare components instead, not
  // show up as their own line here.
  const items = useMemo(() => allItems.filter(item => item.is_active && !item.is_kit), [allItems]);

  // Fetch indents for selected month
  const { data: indents = [], isFetched: indentsFetched, isLoading: indentsLoading } = useQuery<Indent[]>({
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

  // Fetch on-hand stock from batches (read-only, real-time from batch quantities)
  const { data: onHandStock = {}, isFetched: onHandStockFetched, isLoading: onHandStockLoading } = useQuery<Record<number, number>>({
    queryKey: ['/api/batches/on-hand-stock', includeAcceptable],
    queryFn: async () => {
      const response = await fetch(`/api/batches/on-hand-stock?includeAcceptable=${includeAcceptable}`);
      if (!response.ok) throw new Error('Failed to fetch on-hand stock');
      return response.json();
    },
  });

  // Fetch pending orders (ordered - shipped) from server
  const { data: pendingOrdersByItem = {} } = useQuery<Record<number, number>>({
    queryKey: ['/api/orders/pending-by-item'],
  });

  // Sort items: active first, then by name alphabetically
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // Active items (true) should come before inactive (false)
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1;
      }
      // Within same active status, sort by name
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  // Merge data
  const indentData = useMemo(() => {
    return sortedItems.map(item => {
      const indent = indents.find(i => i.item_id === item.id);
      const currentOnHandStock = onHandStock[item.id] || 0;
      
      const expectedReceipts = editingCells[`${item.id}-expected_receipts`] !== undefined ? parseInt(editingCells[`${item.id}-expected_receipts`]) || 0 : indent?.expected_receipts ?? 0;
      // Current safety stock: Use indent value if exists, otherwise default to 0
      const currentSafetyStock = editingCells[`${item.id}-current_safety_stock`] !== undefined ? parseInt(editingCells[`${item.id}-current_safety_stock`]) || 0 : indent?.current_safety_stock ?? 0;
      const pendingQty = pendingOrdersByItem[item.id] || 0;
      
      // SIMPLIFIED: Use On-Hand Stock (from batches) as single source of truth
      // Working Stock = On-Hand Stock + Expected Receipts
      const metrics = calculateInventoryMetrics(
        currentOnHandStock,  // Use actual batch inventory instead of opening balance
        expectedReceipts,
        pendingQty,
        currentSafetyStock,
        item.desired_safety_stock
      );

      return {
        id: item.id,
        item_name: item.name,
        finish: item.finish,
        bare_item_id: item.bare_item_id,
        on_hand_stock: currentOnHandStock,
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
  }, [sortedItems, indents, pendingOrdersByItem, editingCells, onHandStock]);

  // Second pass: a bare item's real requirement isn't just its own direct
  // orders — it also needs to cover whatever's needed for coating, since
  // every coated piece has to start as a bare casting. Each coated item's
  // own required_to_order already nets out its own stock/safety/pending
  // (via calculateInventoryMetrics above), so this rolls up the NET amount
  // still needed, not the raw order quantity — a coated item sitting on
  // plenty of its own stock correctly contributes 0 here.
  const indentDataWithCoatingRollup = useMemo(() => {
    const requiredForCoatingByBareId = new Map<number, number>();
    for (const row of indentData) {
      if (row.bare_item_id) {
        requiredForCoatingByBareId.set(
          row.bare_item_id,
          (requiredForCoatingByBareId.get(row.bare_item_id) || 0) + row.required_to_order
        );
      }
    }
    return indentData.map(row => {
      const requiredForCoating = requiredForCoatingByBareId.get(row.id) || 0;
      return {
        ...row,
        direct_required_to_order: row.required_to_order,
        required_for_coating: requiredForCoating,
        required_to_order: row.required_to_order + requiredForCoating,
      };
    });
  }, [indentData]);

  // Third pass: rather than showing "Tawa" and "Tawa NS" as two separate
  // rows, merge each coated item into its bare parent's row — they're the
  // same underlying casting at different stages, so one line with a
  // Bare/Coated/Total breakdown is easier to actually read. Only items
  // without a bare_item_id become their own top-level row: real bare items,
  // and any coated item that hasn't been linked yet (kept visible on its
  // own rather than silently hidden, since a missing link is a data gap
  // worth noticing, not something to paper over).
  const mergedIndentRows = useMemo(() => {
    const byId = new Map(indentDataWithCoatingRollup.map(r => [r.id, r]));
    return indentDataWithCoatingRollup
      .filter(row => !row.bare_item_id)
      .map(row => ({
        ...row,
        linkedCoatedItems: indentDataWithCoatingRollup.filter(r => r.bare_item_id === row.id),
      }));
  }, [indentDataWithCoatingRollup]);

  // Needs attention = something's actually due (Total to Order > 0) OR
  // safety stock has drifted to Low/Critical — the latter matters even with
  // nothing currently pending, since the goal is a steady buffer at the
  // factory, not just reacting once an order forces the issue. Sorted by
  // urgency (biggest shortfall first, safety severity as tiebreak) rather
  // than alphabetically, since these are the rows actually worth reading top
  // to bottom. Shown fully open — no need to hunt through everything else
  // just to see the handful of items that matter today.
  const severityRank: Record<string, number> = { critical: 2, low: 1, good: 0 };
  const needsAttention = (row: (typeof mergedIndentRows)[number]) =>
    row.required_to_order > 0 || row.safety_stock_status === 'low' || row.safety_stock_status === 'critical';

  const attentionRows = useMemo(
    () =>
      mergedIndentRows
        .filter(needsAttention)
        .sort((a, b) =>
          b.required_to_order - a.required_to_order ||
          (severityRank[b.safety_stock_status] ?? 0) - (severityRank[a.safety_stock_status] ?? 0)
        ),
    [mergedIndentRows]
  );
  const otherRows = useMemo(() => mergedIndentRows.filter(row => !needsAttention(row)), [mergedIndentRows]);
  const [showAllItems, setShowAllItems] = useState(false);

  // Save mutation for indent data
  const saveIndentMutation = useMutation({
    mutationFn: async (data: { item_id: number; month: string; expected_receipts: number; current_safety_stock: number }[]) => {
      await Promise.all(
        data.map(indent => apiRequest('POST', '/api/indents', indent))
      );
    },
    onSuccess: async (_, variables) => {
      // Refetch and wait for the query to complete before clearing editing state
      await queryClient.refetchQueries({ queryKey: ['/api/indents', selectedMonth] });
      
      // Clear editing cells only for successfully saved items (indent fields)
      // Clear editing state for saved items
      setEditingCells(prev => {
        const updated = { ...prev };
        variables.forEach(item => {
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
    
    // Mark this item as dirty if it's an indent field
    if (field === 'expected_receipts' || field === 'current_safety_stock') {
      setDirtyItems(prev => new Set(prev).add(itemId));
    }
  };

  const indentColumns = [
    { key: 'item_name', label: 'Item Name' },
    { 
      key: 'on_hand_stock', 
      label: 'Current Stock (from Batches)', 
      render: (value: number, row: any) => (
        <div 
          className="font-mono text-sm px-2 py-1 bg-muted/30 rounded"
          data-testid={`text-on-hand-stock-${row.id}`}
          title="Real-time stock from batches (read-only)"
        >
          {value.toLocaleString()}
        </div>
      )
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
      label: 'Desired Safety Stock',
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
    { 
      key: 'usable_stock', 
      label: 'Total Usable Stock',
      render: (value: number, row: any) => (
        <span className="font-medium" data-testid={`text-usable-stock-${row.id}`}>
          {value}
        </span>
      )
    },
    { key: 'pending_order_qty', label: 'Pending Orders' },
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
      key: 'required_for_coating', 
      label: 'Req. for Coating', 
      render: (value: number, row: any) => (
        value > 0 ? (
          <span className="font-semibold text-purple-600 dark:text-purple-400" data-testid={`text-coating-${row.id}`} title="Net demand rolled up from coated items linked to this bare item">
            {value}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
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
    },
    {
      key: 'required_to_order',
      label: 'Total to Order',
      render: (value: number, row: any) => (
        <span className={`font-bold ${value > 0 ? 'text-destructive' : 'text-muted-foreground'}`} data-testid={`text-total-${row.id}`} title="Req. to Fulfill Orders + Req. for Coating + Req. for Safety Stock">
          {value}
        </span>
      )
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
          <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md">
            <Switch
              id="include-acceptable"
              checked={includeAcceptable}
              onCheckedChange={setIncludeAcceptable}
              data-testid="switch-include-acceptable"
            />
            <Label htmlFor="include-acceptable" className="text-sm cursor-pointer">
              Include Acceptable Quality
            </Label>
          </div>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      {/* Formula Explanation - Collapsible */}
      <Collapsible open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <div className="bg-muted/50 rounded-lg border">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto">
              <span className="flex items-center gap-2 font-medium">
                <HelpCircle className="h-4 w-4" />
                How Stock Tracking Works
              </span>
              {isHelpOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              <div>
                <h3 className="font-medium mb-2">Simplified Stock Tracking:</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Current Stock (from Batches)</strong>: Real-time inventory from your batches - this is your single source of truth!</p>
                  <p><strong>Expected Receipts</strong>: Batches you plan to receive this month (update this to 0 when batches arrive to avoid double counting)</p>
                  <p className="text-xs pt-1 italic">Your batches drive everything. When batches arrive, reduce Expected Receipts to avoid counting them twice!</p>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Two-Tier Inventory Model:</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Working Stock</strong> = Current Stock + Expected Receipts <span className="text-xs">(normal operational inventory)</span></p>
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
                  <p><strong>Desired Safety Stock</strong>: Long-term desired safety stock level (set in Items page)</p>
                  <p><strong>Current Safety Stock</strong>: Month-specific safety stock you can actually maintain based on production capacity, caster bottlenecks, and demand</p>
                  <p className="text-xs pt-1 italic">Current safety stock defaults to desired but can be adjusted monthly. All changes auto-save.</p>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Safety Stock Status Legend:</h3>
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" data-testid="badge-legend-critical">Critical</Badge>
                    <span className="text-muted-foreground">Cannot fulfill orders (negative stock)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid="badge-legend-low">Low</Badge>
                    <span className="text-muted-foreground">Can fulfill orders but safety stock below target</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" data-testid="badge-legend-good">Good</Badge>
                    <span className="text-muted-foreground">Stock after pending ≥ desired safety stock</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Refill Needed</Badge>
                    <span className="text-muted-foreground">Appears when safety stock needs refilling</span>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Indent — items needing attention shown fully open (no clicking
          needed); everything else tucked behind a toggle */}
      {(() => {
        const finishLabel: Record<string, string> = { bare: "Bare", nonstick: "NS", ceramic: "CER" };
        const breakdownColumnsFor = (row: (typeof mergedIndentRows)[number]) =>
          indentColumns.filter(c => c.key !== "item_name" && c.key !== "required_for_coating");

        const RowHeader = ({ row }: { row: (typeof mergedIndentRows)[number] }) => (
          <div className="flex flex-1 items-center justify-between gap-3 pr-4 flex-wrap">
            <div className="flex items-center gap-2 text-left flex-wrap">
              <span className="font-medium">{row.item_name}</span>
              {row.finish && (
                <Badge variant="outline" className="text-xs">{finishLabel[row.finish] || row.finish}</Badge>
              )}
              {row.linkedCoatedItems.map(c => (
                <Badge key={c.id} variant="secondary" className="text-xs">
                  {finishLabel[c.finish || ''] || c.finish} linked
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:inline">Total to Order</span>
              <span className={`font-mono font-bold ${row.required_to_order > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {row.required_to_order}
              </span>
            </div>
          </div>
        );

        const RowBreakdown = ({ row }: { row: (typeof mergedIndentRows)[number] }) => {
          const breakdownColumns = breakdownColumnsFor(row);
          const hasLinkedCoated = row.linkedCoatedItems.length > 0;
          if (!hasLinkedCoated) {
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                {breakdownColumns.map((col) => (
                  <div key={col.key}>
                    <div className="text-xs text-muted-foreground mb-1">{col.label}</div>
                    <div>{col.render ? (col.render as any)((row as any)[col.key], row) : (row as any)[col.key]}</div>
                  </div>
                ))}
              </div>
            );
          }
          return (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold mb-2">Bare</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                  {breakdownColumns.map((col) => (
                    <div key={col.key}>
                      <div className="text-xs text-muted-foreground mb-1">{col.label}</div>
                      <div>{col.render ? (col.render as any)((row as any)[col.key], row) : (row as any)[col.key]}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="text-sm font-semibold mb-2">Coated</div>
                <div className="space-y-3">
                  {row.linkedCoatedItems.map(c => (
                    <div key={c.id} className="rounded-md bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">{c.item_name}</span>
                        <Badge variant="outline" className="text-xs">{finishLabel[c.finish || ''] || c.finish}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">On Hand</div>
                          <div className="font-mono">{c.on_hand_stock}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Pending Orders</div>
                          <div className="font-mono">{c.pending_order_qty}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Own Shortfall</div>
                          <div className={`font-mono ${c.direct_required_to_order > 0 ? 'text-destructive' : ''}`}>
                            {c.direct_required_to_order}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm px-1">
                    <span className="text-muted-foreground">Coated Total (rolls into Bare demand below)</span>
                    <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">{row.required_for_coating}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Total to Order (Bare + Coated)</span>
                <span className="font-mono font-bold text-destructive">{row.required_to_order}</span>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Needs Attention ({attentionRows.length})
              </h2>
              {attentionRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Nothing needs attention right now — every item is at or above its safety stock, with no pending shortfalls.
                </p>
              ) : (
                <div className="space-y-3">
                  {attentionRows.map((row) => (
                    <div
                      key={row.id}
                      className="border rounded-lg px-4 py-3"
                      data-testid={`indent-item-${row.id}`}
                    >
                      <RowHeader row={row} />
                      <div className="pt-3 mt-3 border-t">
                        <RowBreakdown row={row} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {otherRows.length > 0 && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllItems(!showAllItems)}
                  data-testid="button-toggle-other-items"
                >
                  {showAllItems ? 'Hide' : 'Show'} {otherRows.length} other item{otherRows.length !== 1 ? 's' : ''} not needing attention
                </Button>
                {showAllItems && (
                  <Accordion type="multiple" className="space-y-2 mt-3">
                    {otherRows.map((row) => (
                      <AccordionItem
                        key={row.id}
                        value={`item-${row.id}`}
                        className="border rounded-lg px-4"
                        data-testid={`indent-item-${row.id}`}
                      >
                        <AccordionTrigger className="hover:no-underline py-3">
                          <RowHeader row={row} />
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 pt-1">
                          <RowBreakdown row={row} />
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
