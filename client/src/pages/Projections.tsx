import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Customer, Item } from '@shared/schema';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

type ProjectionDetailRow = {
  id: number;
  item_id: number;
  customer_id: number | null;
  month: string;
  quantity: number;
  item_name: string;
  customer_name: string | null;
};

type MetalSheetItem = {
  itemId: number;
  itemName: string;
  sku: string;
  projectedQty: number;
  allocatedQty: number;
  unitWeightKg: number | null;
  metalKg: number | null;
  isManualOverride: boolean;
};

type MetalSheet = {
  vendors: Array<{ casterId: number; casterName: string; items: MetalSheetItem[]; subtotalKg: number }>;
  unassigned: Array<{ itemId: number; itemName: string; sku: string; projectedQty: number }>;
  grandTotalKg: number;
};

function getMonthOptions() {
  const now = new Date();
  return [0, 1, 2, 3].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    return { key, label };
  });
}

export default function Projections() {
  const { toast } = useToast();
  const { canMutate } = useAuth();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [month, setMonth] = useState(monthOptions[1]?.key || monthOptions[0].key); // default to next month

  return (
    <div className="space-y-6 no-print-margins" data-testid="page-projections">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .app-shell { display: block !important; height: auto !important; overflow: visible !important; }
          .app-main { overflow: visible !important; padding: 0 !important; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-semibold">Projections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What each customer expects to need, and how much metal that means sending to each caster.
          </p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-projections-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => (
              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="customer" className="w-full">
        <TabsList className="no-print">
          <TabsTrigger value="customer">By Customer</TabsTrigger>
          <TabsTrigger value="sheet">Metal Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="customer">
          <CustomerProjectionsTab month={month} canMutate={canMutate} />
        </TabsContent>

        <TabsContent value="sheet">
          <MetalSheetTab month={month} monthLabel={monthOptions.find(m => m.key === month)?.label || month} canMutate={canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomerProjectionsTab({ month, canMutate }: { month: string; canMutate: boolean }) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [deletingRow, setDeletingRow] = useState<ProjectionDetailRow | null>(null);

  const { data: rows = [] } = useQuery<ProjectionDetailRow[]>({
    queryKey: ['/api/projections', month, 'by-customer'],
    queryFn: async () => {
      const res = await fetch(`/api/projections/${month}/by-customer`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch projections');
      return res.json();
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ['/api/customers'] });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ['/api/items'] });
  const bareItems = useMemo(
    () => items.filter(i => i.is_active && !i.is_kit && (!i.finish || i.finish === 'bare')),
    [items]
  );

  const resetForm = () => {
    setCustomerId('');
    setItemId('');
    setQuantity('');
    setIsAdding(false);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/projections', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
      toast({ title: 'Projection saved' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving projection', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/projections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
      toast({ title: 'Projection deleted' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (!customerId || !itemId || !qty || qty <= 0) {
      toast({ title: 'Please fill customer, item, and a positive quantity', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({
      customer_id: parseInt(customerId),
      item_id: parseInt(itemId),
      month,
      quantity: qty,
    });
  };

  // Rows = customers, columns = items — a proper matrix instead of one card
  // per customer, since that stops scaling once there are more than a
  // handful of either.
  const customerIds = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach(r => { if (r.customer_id) map.set(r.customer_id, r.customer_name || `Customer #${r.customer_id}`); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const itemIds = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach(r => map.set(r.item_id, r.item_name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const cellMap = useMemo(() => {
    const map = new Map<string, ProjectionDetailRow>();
    rows.forEach(r => { if (r.customer_id) map.set(`${r.customer_id}-${r.item_id}`, r); });
    return map;
  }, [rows]);

  const [editingCell, setEditingCell] = useState<{ customerId: number; itemId: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleSaveCell = (customerId: number, itemId: number) => {
    const qty = parseInt(editValue);
    if (isNaN(qty) || qty < 0) {
      toast({ title: 'Enter a valid quantity', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ customer_id: customerId, item_id: itemId, month, quantity: qty }, {
      onSuccess: () => setEditingCell(null),
    });
  };

  const columnTotal = (itemId: number) => customerIds.reduce((sum, [cId]) => sum + (cellMap.get(`${cId}-${itemId}`)?.quantity || 0), 0);
  const rowTotal = (customerId: number) => itemIds.reduce((sum, [iId]) => sum + (cellMap.get(`${customerId}-${iId}`)?.quantity || 0), 0);
  const grandTotal = itemIds.reduce((sum, [iId]) => sum + columnTotal(iId), 0);

  return (
    <div className="space-y-4">
      {canMutate && (
        <div className="no-print">
          {!isAdding ? (
            <Button size="sm" onClick={() => setIsAdding(true)} data-testid="button-add-projection">
              <Plus className="h-4 w-4 mr-1" />
              Add Customer / Item
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="border rounded-md p-4 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger data-testid="select-projection-customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 w-full">
                <Label>Item (bare castings)</Label>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger data-testid="select-projection-item"><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>
                    {bareItems.map(i => (
                      <SelectItem key={i.id} value={i.id.toString()}>{i.name} ({i.sku})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-32">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="input-projection-quantity" />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save'}</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {customerIds.length === 0 || itemIds.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No projections entered for this month yet.</p>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <table className="text-sm w-full">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/30">Customer</th>
                {itemIds.map(([iId, iName]) => (
                  <th key={iId} className="text-right px-3 py-2 font-medium whitespace-nowrap">{iName}</th>
                ))}
                <th className="text-right px-3 py-2 font-semibold border-l">Total</th>
              </tr>
            </thead>
            <tbody>
              {customerIds.map(([cId, cName]) => (
                <tr key={cId} className="border-t">
                  <td className="px-3 py-2 font-medium sticky left-0 bg-background">{cName}</td>
                  {itemIds.map(([iId]) => {
                    const cell = cellMap.get(`${cId}-${iId}`);
                    const isEditing = editingCell?.customerId === cId && editingCell?.itemId === iId;
                    return (
                      <td key={iId} className="text-right px-3 py-2 font-mono">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1 no-print">
                            <Input
                              autoFocus
                              type="number"
                              min="0"
                              className="w-20 h-7 text-right"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveCell(cId, iId)}
                              data-testid={`input-cell-${cId}-${iId}`}
                            />
                            <Button size="sm" className="h-7" onClick={() => handleSaveCell(cId, iId)}>Save</Button>
                            {cell && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setDeletingRow(cell); setEditingCell(null); }}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={canMutate ? 'cursor-pointer hover:underline' : ''}
                            onClick={() => {
                              if (!canMutate) return;
                              setEditingCell({ customerId: cId, itemId: iId });
                              setEditValue((cell?.quantity ?? '').toString());
                            }}
                            data-testid={`text-cell-${cId}-${iId}`}
                          >
                            {cell ? cell.quantity.toLocaleString() : <span className="text-muted-foreground">—</span>}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right px-3 py-2 font-semibold border-l">{rowTotal(cId).toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t-2 bg-muted/20">
                <td className="px-3 py-2 font-semibold sticky left-0 bg-muted/20">Total</td>
                {itemIds.map(([iId]) => (
                  <td key={iId} className="text-right px-3 py-2 font-semibold font-mono">{columnTotal(iId).toLocaleString()}</td>
                ))}
                <td className="text-right px-3 py-2 font-bold border-l">{grandTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deletingRow !== null}
        onOpenChange={(open) => !open && setDeletingRow(null)}
        onConfirm={() => {
          if (deletingRow) {
            deleteMutation.mutate(deletingRow.id);
            setDeletingRow(null);
          }
        }}
        title="Delete Projection"
        description="This removes it from both the customer breakdown and the metal sheet calculation."
        confirmText="Delete"
      />
    </div>
  );
}

function MetalSheetTab({ month, monthLabel, canMutate }: { month: string; monthLabel: string; canMutate: boolean }) {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<{ itemId: number; casterId: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: sheet, isLoading } = useQuery<MetalSheet>({
    queryKey: ['/api/metal-sheet', month],
    queryFn: async () => {
      const res = await fetch(`/api/metal-sheet/${month}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch metal sheet');
      return res.json();
    },
  });

  const allocMutation = useMutation({
    mutationFn: async (data: { item_id: number; caster_id: number; month: string; quantity: number }) =>
      apiRequest('POST', '/api/metal-allocations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/metal-sheet', month] });
      toast({ title: 'Allocation updated' });
      setEditingCell(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating allocation', description: error.message, variant: 'destructive' });
    },
  });

  const handleSaveEdit = (itemId: number, casterId: number) => {
    const qty = parseInt(editValue);
    if (isNaN(qty) || qty < 0) {
      toast({ title: 'Enter a valid quantity', variant: 'destructive' });
      return;
    }
    allocMutation.mutate({ item_id: itemId, caster_id: casterId, month, quantity: qty });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>;
  if (!sheet) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end no-print">
        <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-metal-sheet">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div id="printable-metal-sheet" className="space-y-6">
        <div className="hidden print:block mb-2">
          <h1 className="text-xl font-bold">Metal Requirement Sheet — {monthLabel}</h1>
          <p className="text-sm text-muted-foreground">Quantity × unit weight + 10%</p>
        </div>

        {sheet.vendors.length === 0 && sheet.unassigned.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No projections entered for this month yet.</p>
        )}

        {sheet.vendors.map(vendor => (
          <div key={vendor.casterId}>
            <h3 className="font-semibold text-base mb-2">{vendor.casterName}</h3>
            <table className="text-sm w-full border-collapse border border-foreground/30">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left px-3 py-1.5 border border-foreground/30 font-medium">Item</th>
                  <th className="text-right px-3 py-1.5 border border-foreground/30 font-medium">Quantity</th>
                  <th className="text-right px-3 py-1.5 border border-foreground/30 font-medium">Weight (kg/unit)</th>
                  <th className="text-right px-3 py-1.5 border border-foreground/30 font-medium">Kg to Order</th>
                </tr>
              </thead>
              <tbody>
                {vendor.items.map(item => {
                  const isEditing = editingCell?.itemId === item.itemId && editingCell?.casterId === vendor.casterId;
                  return (
                    <tr key={item.itemId}>
                      <td className="px-3 py-1.5 border border-foreground/30">
                        {item.itemName} <span className="text-xs text-muted-foreground">({item.sku})</span>
                      </td>
                      <td className="text-right px-3 py-1.5 border border-foreground/30 font-mono">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1 no-print">
                            <Input
                              autoFocus
                              type="number"
                              min="0"
                              className="w-20 h-7 text-right"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.itemId, vendor.casterId)}
                              data-testid={`input-allocation-${item.itemId}-${vendor.casterId}`}
                            />
                            <Button size="sm" className="h-7" onClick={() => handleSaveEdit(item.itemId, vendor.casterId)}>Save</Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={`${canMutate ? 'cursor-pointer hover:underline' : ''} ${item.isManualOverride ? 'text-purple-600 dark:text-purple-400' : ''}`}
                            onClick={() => {
                              if (!canMutate) return;
                              setEditingCell({ itemId: item.itemId, casterId: vendor.casterId });
                              setEditValue(item.allocatedQty.toString());
                            }}
                            data-testid={`text-allocation-${item.itemId}-${vendor.casterId}`}
                          >
                            {item.allocatedQty.toLocaleString()}
                            {item.isManualOverride && <span className="text-xs ml-1">*</span>}
                          </button>
                        )}
                      </td>
                      <td className="text-right px-3 py-1.5 border border-foreground/30 font-mono">{item.unitWeightKg ?? '—'}</td>
                      <td className="text-right px-3 py-1.5 border border-foreground/30 font-mono font-semibold">
                        {item.metalKg != null ? item.metalKg.toFixed(1) : (
                          <span className="text-destructive text-xs">no weight</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/20">
                  <td className="px-3 py-1.5 border border-foreground/30 font-semibold" colSpan={3}>Subtotal</td>
                  <td className="text-right px-3 py-1.5 border border-foreground/30 font-bold">{vendor.subtotalKg.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <p className="text-xs text-muted-foreground no-print">
          Click any Quantity to manually adjust it — values marked * have been manually overridden. Everything else defaults to an even split across every vendor holding that item's die.
        </p>

        {sheet.unassigned.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader className="py-3">
              <CardTitle className="text-base text-destructive">Unassigned — no caster holds a die for these</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {sheet.unassigned.map(u => (
                  <div key={u.itemId} className="flex justify-between">
                    <span>{u.itemName} ({u.sku})</span>
                    <span className="font-mono">{u.projectedQty.toLocaleString()} projected</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Add a die record on the Vendors page to include these here.</p>
            </CardContent>
          </Card>
        )}

        {sheet.vendors.length > 0 && (
          <div className="flex justify-between items-center px-2 py-3 border-t-2 font-semibold">
            <span>Grand Total</span>
            <span className="font-mono text-lg">{sheet.grandTotalKg.toFixed(1)} kg</span>
          </div>
        )}
      </div>
    </div>
  );
}
