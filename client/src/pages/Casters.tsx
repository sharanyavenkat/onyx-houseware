import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Package, CalendarDays, FileText } from 'lucide-react';
import type { Caster, Item, PurchaseOrder, PurchaseOrderItem } from '@shared/schema';

const casterFields = [
  { name: 'name', label: 'Caster Name', type: 'text' as const, required: true, placeholder: 'Enter caster name' },
  { name: 'address', label: 'Address', type: 'textarea' as const, placeholder: 'Complete address...' },
  { name: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Additional notes...' },
];

const casterColumns = [
  { key: 'name', label: 'Caster Name', isPrimary: true },
  { key: 'address', label: 'Address', hideOnMobile: true },
];

type ReportItem = {
  item_id: number;
  item_name: string;
  qty_received: number;
  qty_produced: number;
  qty_rejected: number;
  batch_count: number;
};

type MonthlyReport = Record<string, ReportItem[]>;

type POWithDetails = PurchaseOrder & {
  caster_name: string;
  line_items: (PurchaseOrderItem & { item_name: string; sku: string })[];
};

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

const purchaseOrderFormSchema = z.object({
  po_number: z.string().min(1, "PO number is required"),
  caster_id: z.string().min(1, "Caster is required"),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  notes: z.string().optional(),
  line_items: z.array(z.object({
    item_id: z.string().min(1, "Item is required"),
    quantity_ordered: z.string().min(1, "Quantity is required"),
  })).min(1, "At least one item is required"),
});

type POFormData = z.infer<typeof purchaseOrderFormSchema>;

export default function Casters() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaster, setEditingCaster] = useState<Caster | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [casterToDelete, setCasterToDelete] = useState<Caster | null>(null);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<POWithDetails | null>(null);
  const [isPODeleteConfirmOpen, setIsPODeleteConfirmOpen] = useState(false);
  const [poToDelete, setPOToDelete] = useState<POWithDetails | null>(null);
  const { toast } = useToast();
  const { canMutate } = useAuth();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const monthOptions = useMemo(() => getMonthOptions(), []);

  const { data: casters = [] } = useQuery<Caster[]>({
    queryKey: ['/api/casters'],
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  const { data: purchaseOrders = [] } = useQuery<POWithDetails[]>({
    queryKey: ['/api/purchase-orders'],
  });

  const { data: monthlyReport = {}, isLoading: reportLoading } = useQuery<MonthlyReport>({
    queryKey: ['/api/batches/monthly-report', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/batches/monthly-report?month=${selectedMonth}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
  });

  const casterMap = useMemo(() => {
    return new Map(casters.map(c => [c.id, c.name]));
  }, [casters]);

  const castersWithData = useMemo(() => {
    return Object.entries(monthlyReport).map(([casterId, items]) => ({
      casterId: parseInt(casterId),
      casterName: casterMap.get(parseInt(casterId)) || "Unknown Caster",
      items,
      totalReceived: items.reduce((sum, i) => sum + i.qty_received, 0),
      totalProduced: items.reduce((sum, i) => sum + i.qty_produced, 0),
      totalRejected: items.reduce((sum, i) => sum + i.qty_rejected, 0),
      totalBatches: items.reduce((sum, i) => sum + i.batch_count, 0),
    }));
  }, [monthlyReport, casterMap]);

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  // Caster CRUD
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/casters', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/casters'] });
      toast({ title: 'Caster created successfully' });
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating caster', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/casters/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/casters'] });
      toast({ title: 'Caster updated successfully' });
      setIsModalOpen(false);
      setEditingCaster(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating caster', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/casters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/casters'] });
      toast({ title: 'Caster deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting caster', description: error.message, variant: 'destructive' });
    },
  });

  // Purchase Order CRUD
  const createPOMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/purchase-orders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      toast({ title: 'Purchase order created successfully' });
      setIsPOModalOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating purchase order', description: error.message, variant: 'destructive' });
    },
  });

  const updatePOMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/purchase-orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      toast({ title: 'Purchase order updated successfully' });
      setIsPOModalOpen(false);
      setEditingPO(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating purchase order', description: error.message, variant: 'destructive' });
    },
  });

  const deletePOMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/purchase-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/batches/on-hand-stock'] });
      toast({ title: 'Purchase order deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting purchase order', description: error.message, variant: 'destructive' });
    },
  });

  const handleAdd = () => {
    setEditingCaster(null);
    setIsModalOpen(true);
  };

  const handleEdit = (caster: Caster) => {
    setEditingCaster(caster);
    setIsModalOpen(true);
  };

  const handleDelete = (caster: Caster) => {
    setCasterToDelete(caster);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (casterToDelete) {
      deleteMutation.mutate(casterToDelete.id);
      setIsConfirmOpen(false);
      setCasterToDelete(null);
    }
  };

  const [, setLocation] = useLocation();

  const handleSubmit = (data: any) => {
    if (editingCaster) {
      updateMutation.mutate({ id: editingCaster.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleView = (caster: Caster) => {
    setLocation(`/casters/${caster.id}`);
  };

  const handleAddPO = () => {
    setEditingPO(null);
    setIsPOModalOpen(true);
  };

  const handleEditPO = (po: POWithDetails) => {
    setEditingPO(po);
    setIsPOModalOpen(true);
  };

  const handleDeletePO = (po: POWithDetails) => {
    setPOToDelete(po);
    setIsPODeleteConfirmOpen(true);
  };

  const confirmDeletePO = () => {
    if (poToDelete) {
      deletePOMutation.mutate(poToDelete.id);
      setIsPODeleteConfirmOpen(false);
      setPOToDelete(null);
    }
  };

  return (
    <div data-testid="page-casters">
      <Tabs defaultValue="monthly-report" className="w-full">
        <TabsList className="w-full justify-start flex-wrap gap-1">
          <TabsTrigger value="monthly-report" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Monthly Report</span>
            <span className="sm:hidden">Report</span>
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Purchases
          </TabsTrigger>
          <TabsTrigger value="casters" className="gap-1.5">
            <Package className="h-4 w-4" />
            Casters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly-report">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg">Monthly Castings Report</CardTitle>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-56" data-testid="select-report-month">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading report...</div>
              ) : castersWithData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No castings received in {selectedMonthLabel}
                </div>
              ) : (
                <div className="space-y-6">
                  {castersWithData.map(({ casterId, casterName, items: reportItems, totalReceived, totalRejected, totalBatches }) => (
                    <div key={casterId} className="border rounded-md">
                      <div className="px-4 py-3 border-b bg-muted/30">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <h3 className="font-semibold">{casterName}</h3>
                          <div className="text-sm text-muted-foreground">
                            {totalBatches} batch{totalBatches !== 1 ? 'es' : ''} &mdash; {totalReceived.toLocaleString()} pcs received
                            {totalRejected > 0 && (
                              <span className="text-destructive ml-1">
                                ({totalRejected.toLocaleString()} rejected)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/20">
                            <tr>
                              <th className="text-left py-2 px-4 font-medium">Item</th>
                              <th className="text-right py-2 px-4 font-medium">Qty Received</th>
                              <th className="text-right py-2 px-4 font-medium">Qty Rejected</th>
                              <th className="text-right py-2 px-4 font-medium">Final Qty</th>
                              <th className="text-right py-2 px-4 font-medium">Batches</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportItems.map(item => (
                              <tr key={item.item_id} className="border-t">
                                <td className="py-2 px-4 font-medium">{item.item_name}</td>
                                <td className="py-2 px-4 text-right font-mono">{item.qty_received.toLocaleString()}</td>
                                <td className={`py-2 px-4 text-right font-mono ${item.qty_rejected > 0 ? 'text-destructive font-medium' : ''}`}>
                                  {item.qty_rejected.toLocaleString()}
                                </td>
                                <td className="py-2 px-4 text-right font-mono font-semibold">{item.qty_produced.toLocaleString()}</td>
                                <td className="py-2 px-4 text-right font-mono">{item.batch_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="sm:hidden divide-y">
                        {reportItems.map(item => (
                          <div key={item.item_id} className="px-4 py-3">
                            <div className="font-medium mb-1">{item.item_name}</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground text-xs">Received</span>
                                <div className="font-mono">{item.qty_received.toLocaleString()}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Rejected</span>
                                <div className={`font-mono ${item.qty_rejected > 0 ? 'text-destructive' : ''}`}>
                                  {item.qty_rejected.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Final Qty</span>
                                <div className="font-mono font-semibold">{item.qty_produced.toLocaleString()}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Batches</span>
                                <div className="font-mono">{item.batch_count}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <PurchasesTab
            purchaseOrders={purchaseOrders}
            casters={casters}
            items={items}
            canMutate={canMutate}
            onAdd={handleAddPO}
            onEdit={handleEditPO}
            onDelete={handleDeletePO}
          />
        </TabsContent>

        <TabsContent value="casters">
          <DataTable 
            columns={casterColumns}
            data={casters}
            title="Casters"
            addButtonLabel="Add Caster"
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            canMutate={canMutate}
          />
        </TabsContent>
      </Tabs>
      
      <FormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCaster(null);
        }}
        onSubmit={handleSubmit}
        title={editingCaster ? 'Edit Caster' : 'Add New Caster'}
        fields={casterFields}
        initialData={editingCaster || {}}
        submitLabel={editingCaster ? 'Update Caster' : 'Add Caster'}
      />

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Caster"
        description={`Are you sure you want to delete "${casterToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
      />

      <PurchaseOrderModal
        isOpen={isPOModalOpen}
        onOpenChange={setIsPOModalOpen}
        editingPO={editingPO}
        casters={casters}
        items={items}
        onSubmit={(data) => {
          const payload = {
            po_number: data.po_number,
            caster_id: parseInt(data.caster_id),
            order_date: data.order_date,
            notes: data.notes || null,
            line_items: data.line_items.map(li => ({
              item_id: parseInt(li.item_id),
              quantity_ordered: parseInt(li.quantity_ordered),
            })),
          };
          if (editingPO) {
            updatePOMutation.mutate({ id: editingPO.id, data: payload });
          } else {
            createPOMutation.mutate(payload);
          }
        }}
        isPending={createPOMutation.isPending || updatePOMutation.isPending}
      />

      <ConfirmDialog
        open={isPODeleteConfirmOpen}
        onOpenChange={setIsPODeleteConfirmOpen}
        onConfirm={confirmDeletePO}
        title="Delete Purchase Order"
        description={`Are you sure you want to delete purchase order "${poToDelete?.po_number}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}

function PurchasesTab({
  purchaseOrders,
  casters,
  items,
  canMutate,
  onAdd,
  onEdit,
  onDelete,
}: {
  purchaseOrders: POWithDetails[];
  casters: Caster[];
  items: Item[];
  canMutate: boolean;
  onAdd: () => void;
  onEdit: (po: POWithDetails) => void;
  onDelete: (po: POWithDetails) => void;
}) {
  const sortByDate = (a: POWithDetails, b: POWithDetails) => 
    new Date(b.order_date).getTime() - new Date(a.order_date).getTime();
  const confirmedPOs = purchaseOrders.filter(po => po.status === 'confirmed').sort(sortByDate);
  const completedPOs = purchaseOrders.filter(po => po.status === 'completed').sort(sortByDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Purchase Orders</h2>
        {canMutate && (
          <Button onClick={onAdd} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Button>
        )}
      </div>

      {purchaseOrders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No purchase orders yet. Create one to start tracking material from casters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {confirmedPOs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Orders</h3>
              {confirmedPOs.map(po => (
                <POCard key={po.id} po={po} canMutate={canMutate} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
          {completedPOs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed Orders</h3>
              {completedPOs.map(po => (
                <POCard key={po.id} po={po} canMutate={canMutate} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function POCard({
  po,
  canMutate,
  onEdit,
  onDelete,
}: {
  po: POWithDetails;
  canMutate: boolean;
  onEdit: (po: POWithDetails) => void;
  onDelete: (po: POWithDetails) => void;
}) {
  const totalOrdered = po.line_items.reduce((s, i) => s + i.quantity_ordered, 0);
  const totalReceived = po.line_items.reduce((s, i) => s + i.quantity_received, 0);
  const totalRemaining = Math.max(0, totalOrdered - totalReceived);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">{po.po_number}</CardTitle>
            <Badge variant={po.status === 'completed' ? 'secondary' : 'default'} className="text-xs">
              {po.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{po.caster_name}</span>
            {canMutate && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => onEdit(po)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(po)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3 text-sm text-muted-foreground">
          <span>Ordered: {new Date(po.order_date).toLocaleDateString()}</span>
          <span className="font-medium text-foreground">
            {totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()} received
            {totalRemaining > 0 && (
              <span className="text-orange-600 dark:text-orange-400 ml-1">
                ({totalRemaining.toLocaleString()} remaining)
              </span>
            )}
          </span>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20">
              <tr>
                <th className="text-left py-1.5 px-3 font-medium">Item</th>
                <th className="text-right py-1.5 px-3 font-medium">Ordered</th>
                <th className="text-right py-1.5 px-3 font-medium">Received</th>
                <th className="text-right py-1.5 px-3 font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {po.line_items.map(item => {
                const remaining = Math.max(0, item.quantity_ordered - item.quantity_received);
                return (
                  <tr key={item.id} className="border-t">
                    <td className="py-1.5 px-3">{item.item_name}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{item.quantity_ordered.toLocaleString()}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{item.quantity_received.toLocaleString()}</td>
                    <td className={`py-1.5 px-3 text-right font-mono ${remaining > 0 ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}`}>
                      {remaining.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden divide-y">
          {po.line_items.map(item => {
            const remaining = Math.max(0, item.quantity_ordered - item.quantity_received);
            return (
              <div key={item.id} className="py-2">
                <div className="font-medium text-sm">{item.item_name}</div>
                <div className="grid grid-cols-3 gap-2 text-sm mt-1">
                  <div>
                    <span className="text-muted-foreground text-xs">Ordered</span>
                    <div className="font-mono">{item.quantity_ordered.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Received</span>
                    <div className="font-mono">{item.quantity_received.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Remaining</span>
                    <div className={`font-mono ${remaining > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                      {remaining.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {po.notes && (
          <div className="mt-2 text-sm text-muted-foreground border-t pt-2">{po.notes}</div>
        )}
      </CardContent>
    </Card>
  );
}

function PurchaseOrderModal({
  isOpen,
  onOpenChange,
  editingPO,
  casters,
  items,
  onSubmit,
  isPending,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingPO: POWithDetails | null;
  casters: Caster[];
  items: Item[];
  onSubmit: (data: POFormData) => void;
  isPending: boolean;
}) {
  const form = useForm<POFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      po_number: '',
      caster_id: '',
      order_date: new Date().toISOString().split('T')[0],
      notes: '',
      line_items: [{ item_id: '', quantity_ordered: '' }],
    },
  });

  const lineItems = form.watch('line_items');

  const resetFormForEdit = () => {
    if (editingPO) {
      form.reset({
        po_number: editingPO.po_number,
        caster_id: editingPO.caster_id.toString(),
        order_date: editingPO.order_date,
        notes: editingPO.notes || '',
        line_items: editingPO.line_items.map(li => ({
          item_id: li.item_id.toString(),
          quantity_ordered: li.quantity_ordered.toString(),
        })),
      });
    } else {
      form.reset({
        po_number: '',
        caster_id: '',
        order_date: new Date().toISOString().split('T')[0],
        notes: '',
        line_items: [{ item_id: '', quantity_ordered: '' }],
      });
    }
  };

  const addLineItem = () => {
    const current = form.getValues('line_items');
    form.setValue('line_items', [...current, { item_id: '', quantity_ordered: '' }]);
  };

  const removeLineItem = (index: number) => {
    const current = form.getValues('line_items');
    if (current.length > 1) {
      form.setValue('line_items', current.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (open) resetFormForEdit();
        onOpenChange(open);
      }}
    >
      <DialogContent onOpenAutoFocus={() => resetFormForEdit()}>
        <DialogHeader>
          <DialogTitle>{editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="po_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., PO-2026-001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="caster_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caster</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select caster" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {casters.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="order_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <FormLabel>Items & Quantities</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Add Item
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lineItems.map((_, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <FormField
                      control={form.control}
                      name={`line_items.${index}.item_id`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {items.filter(i => i.is_active).map(item => (
                                <SelectItem key={item.id} value={item.id.toString()}>
                                  {item.name} ({item.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`line_items.${index}.quantity_ordered`}
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, '');
                                field.onChange(value);
                              }}
                              placeholder="Qty"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes..." className="resize-none" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : editingPO ? 'Update' : 'Create Purchase Order'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
