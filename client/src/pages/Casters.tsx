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
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, X, Pencil, Trash2, Package, CalendarDays, FileText, Scale, ChevronDown, ChevronRight } from 'lucide-react';
import type { Caster, Item, PurchaseOrder, PurchaseOrderItem, IngotDispatch, Die, Rework, VendorMetalStatement } from '@shared/schema';

const casterFields = [
  { name: 'name', label: 'Vendor Name', type: 'text' as const, required: true, placeholder: 'Enter vendor name' },
  {
    name: 'vendor_type',
    label: 'Vendor Type',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'caster', label: 'Caster' },
      { value: 'handle_vendor', label: 'Handle Vendor' },
      { value: 'coater', label: 'Coater' },
      { value: 'packer', label: 'Packer' },
      { value: 'material_supplier', label: 'Material Supplier' },
      { value: 'other', label: 'Other' },
    ],
  },
  { name: 'contact_person', label: 'Contact Person', type: 'text' as const, placeholder: 'Who you deal with day to day' },
  { name: 'phone', label: 'Phone', type: 'text' as const, placeholder: 'Contact phone number' },
  { name: 'email', label: 'Email', type: 'email' as const, placeholder: 'Contact email' },
  { name: 'address', label: 'Address', type: 'textarea' as const, placeholder: 'Complete address...' },
  { name: 'lead_time_days', label: 'Typical Lead Time (days)', type: 'number' as const, placeholder: 'e.g., 15' },
  { name: 'payment_terms', label: 'Payment Terms', type: 'text' as const, placeholder: 'e.g., 30 days from delivery' },
  { name: 'default_wastage_ingot_pct', label: 'Default Wastage % (Ingot)', type: 'number' as const, placeholder: 'Leave blank to use company default (6%)' },
  { name: 'default_wastage_scrap_pct', label: 'Default Wastage % (Scrap)', type: 'number' as const, placeholder: 'Leave blank to use company default (8%)' },
  {
    name: 'status',
    label: 'Status',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  { name: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Additional notes...' },
];

const vendorTypeLabels: Record<string, string> = {
  caster: 'Caster',
  handle_vendor: 'Handle Vendor',
  coater: 'Coater',
  packer: 'Packer',
  material_supplier: 'Material Supplier',
  other: 'Other',
};

const casterColumns = [
  { key: 'name', label: 'Vendor Name', isPrimary: true },
  {
    key: 'vendor_type',
    label: 'Type',
    render: (value: string) => <Badge variant="outline">{vendorTypeLabels[value] || value}</Badge>,
  },
  { key: 'contact_person', label: 'Contact', hideOnMobile: true },
  { key: 'lead_time_days', label: 'Lead Time (days)', hideOnMobile: true },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => (
      <Badge variant={value === 'active' ? 'default' : 'secondary'}>
        {value === 'active' ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

type IngotDispatchWithCaster = IngotDispatch & { caster_name: string };

type IngotReconciliation = {
  totalIngotKgSent: number;
  totalScrapKgSent: number;
  totalMetalKgSent: number;
  totalFinishedWeightKgReceived: number;
  expectedMetalConsumedKg: number | null;
  varianceKg: number | null;
  variancePercent: number | null;
  actualPieceCount: number;
  itemsMissingWeight: Array<{ itemId: number; itemName: string }>;
  rework: {
    totalReworkKgSent: number;
    piecesSent: number;
    piecesReplaced: number;
    piecesPending: number;
  };
};

const ingotFieldsFor = (casters: Caster[]) => [
  {
    name: 'caster_id',
    label: 'Vendor',
    type: 'select' as const,
    required: true,
    options: casters.map(c => ({ value: c.id.toString(), label: c.name })),
  },
  { name: 'dispatch_date', label: 'Dispatch Date', type: 'date' as const, required: true },
  {
    name: 'material_type',
    label: 'Material Type',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'ingot', label: 'Ingot' },
      { value: 'scrap', label: 'Scrap' },
    ],
  },
  { name: 'alloy_grade', label: 'Alloy Grade', type: 'text' as const, placeholder: 'e.g., LM6, LM24' },
  { name: 'quantity_kg', label: 'Quantity (kg)', type: 'number' as const, required: true, placeholder: 'e.g., 500' },
  { name: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Additional notes...' },
];

const ingotColumns = [
  { key: 'dispatch_date', label: 'Date', isPrimary: true },
  { key: 'caster_name', label: 'Caster' },
  {
    key: 'material_type',
    label: 'Type',
    render: (value: string) => (
      <Badge variant={value === 'scrap' ? 'secondary' : value === 'rework' ? 'outline' : 'default'}>
        {value === 'scrap' ? 'Scrap' : value === 'rework' ? 'Rework' : 'Ingot'}
      </Badge>
    ),
  },
  { key: 'alloy_grade', label: 'Alloy', hideOnMobile: true },
  {
    key: 'quantity_kg',
    label: 'Quantity (kg)',
    render: (value: number) => value?.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  },
];

// --- Dies ---
type DieWithNames = Die & { caster_name: string; item_name: string };

const dieFieldsFor = (casters: Caster[], items: Item[]) => [
  {
    name: 'caster_id',
    label: 'Held By (Vendor)',
    type: 'select' as const,
    required: true,
    options: casters.map(c => ({ value: c.id.toString(), label: c.name })),
  },
  {
    name: 'item_id',
    label: 'Produces (SKU)',
    type: 'select' as const,
    required: true,
    options: items.filter(i => !i.is_kit).map(i => ({ value: i.id.toString(), label: `${i.name} (${i.sku})` })),
  },
  {
    name: 'mould_type',
    label: 'Mould Type',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'casting', label: 'Casting Die' },
      { value: 'handle', label: 'Handle Mould' },
    ],
  },
  { name: 'shot_count', label: 'Shot Count', type: 'number' as const, placeholder: 'Total shots since new/last reworked' },
  { name: 'last_rework_date', label: 'Last Rework Date', type: 'date' as const },
  {
    name: 'status',
    label: 'Status',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'retired', label: 'Retired' },
    ],
  },
  { name: 'notes', label: 'Notes', type: 'textarea' as const },
];

const dieColumns = [
  { key: 'item_name', label: 'SKU', isPrimary: true },
  { key: 'caster_name', label: 'Held By' },
  {
    key: 'mould_type',
    label: 'Type',
    render: (value: string) => <Badge variant="outline">{value === 'handle' ? 'Handle Mould' : 'Casting Die'}</Badge>,
  },
  { key: 'shot_count', label: 'Shot Count', hideOnMobile: true },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => (
      <Badge variant={value === 'active' ? 'default' : 'secondary'}>{value === 'active' ? 'Active' : 'Retired'}</Badge>
    ),
  },
];

// --- Reworks ---
type ReworkWithNames = Rework & { caster_name: string; item_name: string };

const reworkFieldsFor = (casters: Caster[], items: Item[]) => [
  {
    name: 'caster_id',
    label: 'Vendor',
    type: 'select' as const,
    required: true,
    options: casters.map(c => ({ value: c.id.toString(), label: c.name })),
  },
  {
    name: 'item_id',
    label: 'SKU',
    type: 'select' as const,
    required: true,
    options: items.filter(i => !i.is_kit).map(i => ({ value: i.id.toString(), label: `${i.name} (${i.sku})` })),
  },
  { name: 'quantity_defective', label: 'Quantity Defective (Sent Back)', type: 'number' as const, required: true },
  { name: 'sent_date', label: 'Sent Date', type: 'date' as const, required: true },
  { name: 'quantity_replaced', label: 'Quantity Replaced So Far', type: 'number' as const },
  { name: 'replacement_received_date', label: 'Replacement Received Date', type: 'date' as const },
  {
    name: 'status',
    label: 'Status',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'partial', label: 'Partially Replaced' },
      { value: 'received', label: 'Fully Replaced' },
    ],
  },
  { name: 'notes', label: 'Notes (e.g. defect type — blowholes etc.)', type: 'textarea' as const },
];

const reworkColumns = [
  { key: 'sent_date', label: 'Sent Date', isPrimary: true },
  { key: 'caster_name', label: 'Caster' },
  { key: 'item_name', label: 'SKU', hideOnMobile: true },
  { key: 'quantity_defective', label: 'Defective Qty' },
  { key: 'quantity_replaced', label: 'Replaced Qty' },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => (
      <Badge variant={value === 'received' ? 'default' : value === 'partial' ? 'secondary' : 'destructive'}>
        {value === 'received' ? 'Fully Replaced' : value === 'partial' ? 'Partial' : 'Pending'}
      </Badge>
    ),
  },
];

// --- Vendor Metal Statements ---
type StatementWithCasterName = VendorMetalStatement & { caster_name: string };

const statementColumns = [
  { key: 'period_month', label: 'Month', isPrimary: true },
  { key: 'caster_name', label: 'Caster' },
  {
    key: 'closing_balance_kg',
    label: 'Our Closing Balance',
    render: (value: number) => formatWeightKg(value),
  },
  {
    key: 'vendor_reported_remaining_kg',
    label: "Vendor's Reported Balance",
    hideOnMobile: true,
    render: (value: number | null) => formatWeightKg(value),
  },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => (
      <Badge variant={value === 'acknowledged' ? 'default' : value === 'sent' ? 'secondary' : 'outline'}>
        {value === 'acknowledged' ? 'Acknowledged' : value === 'sent' ? 'Sent' : 'Draft'}
      </Badge>
    ),
  },
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

// Displays a kg value in whichever unit reads naturally — grams under 1kg,
// kg at 1kg and up — with no forced rounding (weight feeds pricing, so full
// precision is preserved; toFixed(6) here only trims floating-point noise,
// not the actual value).
function formatWeightKg(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || isNaN(kg)) return '—';
  const abs = Math.abs(kg);
  if (abs < 1) {
    return `${(kg * 1000).toFixed(3)} g`;
  }
  return `${kg.toFixed(3)} kg`;
}

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
  const [isIngotModalOpen, setIsIngotModalOpen] = useState(false);
  const [editingIngot, setEditingIngot] = useState<IngotDispatchWithCaster | null>(null);
  const [isIngotDeleteConfirmOpen, setIsIngotDeleteConfirmOpen] = useState(false);
  const [ingotToDelete, setIngotToDelete] = useState<IngotDispatchWithCaster | null>(null);
  const [reconciliationCasterId, setReconciliationCasterId] = useState<string>('');
  const [isDieModalOpen, setIsDieModalOpen] = useState(false);
  const [expandedDieVendors, setExpandedDieVendors] = useState<Set<number>>(new Set());
  const [editingDie, setEditingDie] = useState<DieWithNames | null>(null);
  const [isDieDeleteConfirmOpen, setIsDieDeleteConfirmOpen] = useState(false);
  const [dieToDelete, setDieToDelete] = useState<DieWithNames | null>(null);
  const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);
  const [editingRework, setEditingRework] = useState<ReworkWithNames | null>(null);
  const [isReworkDeleteConfirmOpen, setIsReworkDeleteConfirmOpen] = useState(false);
  const [reworkToDelete, setReworkToDelete] = useState<ReworkWithNames | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [editingStatement, setEditingStatement] = useState<StatementWithCasterName | null>(null);
  const [isStatementDeleteConfirmOpen, setIsStatementDeleteConfirmOpen] = useState(false);
  const [statementToDelete, setStatementToDelete] = useState<StatementWithCasterName | null>(null);
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

  const { data: ingotDispatches = [] } = useQuery<IngotDispatchWithCaster[]>({
    queryKey: ['/api/ingot-dispatches'],
  });

  const { data: ingotReconciliation, isLoading: reconciliationLoading } = useQuery<IngotReconciliation>({
    queryKey: ['/api/casters', reconciliationCasterId, 'ingot-reconciliation'],
    queryFn: async () => {
      const res = await fetch(`/api/casters/${reconciliationCasterId}/ingot-reconciliation`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch reconciliation');
      return res.json();
    },
    enabled: !!reconciliationCasterId,
  });

  const { data: rawStatements = [] } = useQuery<VendorMetalStatement[]>({
    queryKey: ['/api/vendor-metal-statements'],
  });
  const casterNameMap = useMemo(() => new Map(casters.map(c => [c.id, c.name])), [casters]);
  const allStatements: StatementWithCasterName[] = useMemo(
    () => rawStatements.map(s => ({ ...s, caster_name: casterNameMap.get(s.caster_id) || '' })),
    [rawStatements, casterNameMap]
  );

  const { data: allDies = [] } = useQuery<DieWithNames[]>({
    queryKey: ['/api/dies'],
  });

  const diesByVendor = useMemo(() => {
    const groups = new Map<number, { casterName: string; dies: DieWithNames[] }>();
    for (const die of allDies) {
      if (!groups.has(die.caster_id)) {
        groups.set(die.caster_id, { casterName: die.caster_name, dies: [] });
      }
      groups.get(die.caster_id)!.dies.push(die);
    }
    return Array.from(groups.entries())
      .map(([casterId, g]) => ({ casterId, ...g }))
      .sort((a, b) => a.casterName.localeCompare(b.casterName));
  }, [allDies]);

  const toggleDieVendor = (casterId: number) => {
    setExpandedDieVendors(prev => {
      const next = new Set(prev);
      if (next.has(casterId)) next.delete(casterId);
      else next.add(casterId);
      return next;
    });
  };

  const { data: allReworks = [] } = useQuery<ReworkWithNames[]>({
    queryKey: ['/api/reworks'],
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

  // Vendor CRUD
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/casters', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/casters'] });
      toast({ title: 'Vendor created successfully' });
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
      toast({ title: 'Vendor updated successfully' });
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
      toast({ title: 'Vendor deleted successfully' });
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

  // Ingot dispatch CRUD
  const createIngotMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/ingot-dispatches', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingot-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/casters'] });
      toast({ title: 'Ingot dispatch recorded successfully' });
      setIsIngotModalOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error recording ingot dispatch', description: error.message, variant: 'destructive' });
    },
  });

  const updateIngotMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/ingot-dispatches/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingot-dispatches'] });
      toast({ title: 'Ingot dispatch updated successfully' });
      setIsIngotModalOpen(false);
      setEditingIngot(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating ingot dispatch', description: error.message, variant: 'destructive' });
    },
  });

  const deleteIngotMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/ingot-dispatches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingot-dispatches'] });
      toast({ title: 'Ingot dispatch deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting ingot dispatch', description: error.message, variant: 'destructive' });
    },
  });

  const handleAddIngot = () => {
    setEditingIngot(null);
    setIsIngotModalOpen(true);
  };

  const handleEditIngot = (ingot: IngotDispatchWithCaster) => {
    setEditingIngot(ingot);
    setIsIngotModalOpen(true);
  };

  const handleDeleteIngot = (ingot: IngotDispatchWithCaster) => {
    setIngotToDelete(ingot);
    setIsIngotDeleteConfirmOpen(true);
  };

  const confirmDeleteIngot = () => {
    if (ingotToDelete) {
      deleteIngotMutation.mutate(ingotToDelete.id);
      setIsIngotDeleteConfirmOpen(false);
      setIngotToDelete(null);
    }
  };

  const handleSubmitIngot = (data: any) => {
    const processedData = {
      ...data,
      caster_id: parseInt(data.caster_id),
      quantity_kg: parseFloat(data.quantity_kg),
    };
    if (editingIngot) {
      updateIngotMutation.mutate({ id: editingIngot.id, data: processedData });
    } else {
      createIngotMutation.mutate(processedData);
    }
  };

  // Die CRUD
  const createDieMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/dies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dies'] });
      toast({ title: 'Die recorded successfully' });
      setIsDieModalOpen(false);
    },
    onError: (error: Error) => toast({ title: 'Error recording die', description: error.message, variant: 'destructive' }),
  });
  const updateDieMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/dies/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dies'] });
      toast({ title: 'Die updated successfully' });
      setIsDieModalOpen(false);
      setEditingDie(null);
    },
    onError: (error: Error) => toast({ title: 'Error updating die', description: error.message, variant: 'destructive' }),
  });
  const deleteDieMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/dies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dies'] });
      toast({ title: 'Die deleted successfully' });
    },
    onError: (error: Error) => toast({ title: 'Error deleting die', description: error.message, variant: 'destructive' }),
  });
  const handleAddDie = () => { setEditingDie(null); setIsDieModalOpen(true); };
  const handleEditDie = (d: DieWithNames) => { setEditingDie(d); setIsDieModalOpen(true); };
  const handleDeleteDie = (d: DieWithNames) => { setDieToDelete(d); setIsDieDeleteConfirmOpen(true); };
  const confirmDeleteDie = () => {
    if (dieToDelete) { deleteDieMutation.mutate(dieToDelete.id); setIsDieDeleteConfirmOpen(false); setDieToDelete(null); }
  };
  const handleSubmitDie = (data: any) => {
    const processedData = {
      ...data,
      caster_id: parseInt(data.caster_id),
      item_id: parseInt(data.item_id),
      shot_count: data.shot_count ? parseInt(data.shot_count) : 0,
    };
    if (editingDie) {
      updateDieMutation.mutate({ id: editingDie.id, data: processedData });
    } else {
      createDieMutation.mutate(processedData);
    }
  };

  // Rework CRUD
  const createReworkMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/reworks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reworks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/casters'] });
      toast({ title: 'Rework recorded successfully' });
      setIsReworkModalOpen(false);
    },
    onError: (error: Error) => toast({ title: 'Error recording rework', description: error.message, variant: 'destructive' }),
  });
  const updateReworkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/reworks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reworks'] });
      toast({ title: 'Rework updated successfully' });
      setIsReworkModalOpen(false);
      setEditingRework(null);
    },
    onError: (error: Error) => toast({ title: 'Error updating rework', description: error.message, variant: 'destructive' }),
  });
  const deleteReworkMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/reworks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reworks'] });
      toast({ title: 'Rework deleted successfully' });
    },
    onError: (error: Error) => toast({ title: 'Error deleting rework', description: error.message, variant: 'destructive' }),
  });
  const handleAddRework = () => { setEditingRework(null); setIsReworkModalOpen(true); };
  const handleEditRework = (r: ReworkWithNames) => { setEditingRework(r); setIsReworkModalOpen(true); };
  const handleDeleteRework = (r: ReworkWithNames) => { setReworkToDelete(r); setIsReworkDeleteConfirmOpen(true); };
  const confirmDeleteRework = () => {
    if (reworkToDelete) { deleteReworkMutation.mutate(reworkToDelete.id); setIsReworkDeleteConfirmOpen(false); setReworkToDelete(null); }
  };
  const handleSubmitRework = (data: any) => {
    const processedData = {
      ...data,
      caster_id: parseInt(data.caster_id),
      item_id: parseInt(data.item_id),
      quantity_defective: parseInt(data.quantity_defective),
      quantity_replaced: data.quantity_replaced ? parseInt(data.quantity_replaced) : 0,
    };
    if (editingRework) {
      updateReworkMutation.mutate({ id: editingRework.id, data: processedData });
    } else {
      createReworkMutation.mutate(processedData);
    }
  };

  const handleAdd = () => {
    setEditingCaster(null);
    setIsModalOpen(true);
  };

  // Vendor metal statement CRUD
  const createStatementMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/vendor-metal-statements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-metal-statements'] });
      toast({ title: 'Statement saved successfully' });
      setIsStatementModalOpen(false);
    },
    onError: (error: Error) => toast({ title: 'Error saving statement', description: error.message, variant: 'destructive' }),
  });
  const updateStatementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/vendor-metal-statements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-metal-statements'] });
      toast({ title: 'Statement updated successfully' });
      setIsStatementModalOpen(false);
      setEditingStatement(null);
    },
    onError: (error: Error) => toast({ title: 'Error updating statement', description: error.message, variant: 'destructive' }),
  });
  const deleteStatementMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/vendor-metal-statements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-metal-statements'] });
      toast({ title: 'Statement deleted successfully' });
    },
    onError: (error: Error) => toast({ title: 'Error deleting statement', description: error.message, variant: 'destructive' }),
  });
  const handleAddStatement = () => { setEditingStatement(null); setIsStatementModalOpen(true); };
  const handleEditStatement = (s: StatementWithCasterName) => { setEditingStatement(s); setIsStatementModalOpen(true); };
  const handleDeleteStatement = (s: StatementWithCasterName) => { setStatementToDelete(s); setIsStatementDeleteConfirmOpen(true); };
  const confirmDeleteStatement = () => {
    if (statementToDelete) { deleteStatementMutation.mutate(statementToDelete.id); setIsStatementDeleteConfirmOpen(false); setStatementToDelete(null); }
  };
  const handleSubmitStatement = (data: any) => {
    if (editingStatement) {
      updateStatementMutation.mutate({ id: editingStatement.id, data });
    } else {
      createStatementMutation.mutate(data);
    }
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
    const processedData = {
      ...data,
      lead_time_days: data.lead_time_days ? parseInt(data.lead_time_days) : null,
      default_wastage_ingot_pct: data.default_wastage_ingot_pct ? parseFloat(data.default_wastage_ingot_pct) : null,
      default_wastage_scrap_pct: data.default_wastage_scrap_pct ? parseFloat(data.default_wastage_scrap_pct) : null,
    };
    if (editingCaster) {
      updateMutation.mutate({ id: editingCaster.id, data: processedData });
    } else {
      createMutation.mutate(processedData);
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
      <Tabs defaultValue="purchases" className="w-full">
        <TabsList className="w-full justify-start flex-wrap gap-1">
          <TabsTrigger value="purchases" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Purchases
          </TabsTrigger>
          {/* Monthly Report tab hidden — felt redundant with Purchases (ordered vs. received).
              Content left intact below in case it's wanted back later. */}
          <TabsTrigger value="ingots" className="gap-1.5">
            <Scale className="h-4 w-4" />
            Ingots
          </TabsTrigger>
          <TabsTrigger value="statements" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Statements
          </TabsTrigger>
          <TabsTrigger value="dies" className="gap-1.5">
            <Package className="h-4 w-4" />
            Dies
          </TabsTrigger>
          <TabsTrigger value="reworks" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Reworks
          </TabsTrigger>
          <TabsTrigger value="casters" className="gap-1.5">
            <Package className="h-4 w-4" />
            Vendors
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
            title="Vendors"
            addButtonLabel="Add Vendor"
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            canMutate={canMutate}
          />
        </TabsContent>

        <TabsContent value="ingots">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vendor Material Reconciliation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={reconciliationCasterId} onValueChange={setReconciliationCasterId}>
                  <SelectTrigger className="w-full sm:w-64" data-testid="select-reconciliation-caster">
                    <SelectValue placeholder="Select a caster to check" />
                  </SelectTrigger>
                  <SelectContent>
                    {casters.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!reconciliationCasterId ? (
                  <p className="text-sm text-muted-foreground">
                    Pick a caster to compare metal dispatched against the wastage-adjusted metal that should have been consumed to produce what was received back.
                  </p>
                ) : reconciliationLoading ? (
                  <div className="text-sm text-muted-foreground">Calculating...</div>
                ) : ingotReconciliation ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">Metal sent vs. wastage-adjusted expected consumption</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Ingot Sent</div>
                          <div className="font-mono font-semibold">
                            {formatWeightKg(ingotReconciliation.totalIngotKgSent)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Scrap Sent</div>
                          <div className="font-mono font-semibold">
                            {formatWeightKg(ingotReconciliation.totalScrapKgSent)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Total Metal Sent</div>
                          <div className="font-mono font-semibold">
                            {formatWeightKg(ingotReconciliation.totalMetalKgSent)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Finished Weight Received</div>
                          <div className="font-mono font-semibold">
                            {formatWeightKg(ingotReconciliation.totalFinishedWeightKgReceived)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Expected Metal Consumed</div>
                          <div className="font-mono font-semibold">
                            {formatWeightKg(ingotReconciliation.expectedMetalConsumedKg)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Variance</div>
                          <div className="font-mono font-semibold">
                            {formatWeightKg(ingotReconciliation.varianceKg)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Variance %</div>
                          <div className="font-mono font-semibold">
                            {ingotReconciliation.variancePercent === null
                              ? '—'
                              : `${ingotReconciliation.variancePercent.toFixed(1)}%`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">Rework (excluded from balance above — free 1:1 replacement)</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Rework Metal Sent</div>
                          <div className="font-mono font-semibold">
                            {formatWeightKg(ingotReconciliation.rework.totalReworkKgSent)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Pieces Sent Back</div>
                          <div className="font-mono font-semibold">{ingotReconciliation.rework.piecesSent.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Pieces Replaced</div>
                          <div className="font-mono font-semibold">{ingotReconciliation.rework.piecesReplaced.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Pending</div>
                          <div className="font-mono font-semibold">{ingotReconciliation.rework.piecesPending.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      "Expected Metal Consumed" is each batch's finished weight divided by that SKU's resolved wastage rate at this caster (SKU override → vendor default → company default 6%/8%) — not a blended average across SKUs. Treat variance as a signal to investigate, not a hard defect number.
                    </p>
                    {ingotReconciliation.itemsMissingWeight.length > 0 && (
                      <div className="text-xs text-amber-600 dark:text-amber-500">
                        Missing "Finished Weight" on: {ingotReconciliation.itemsMissingWeight.map(i => i.itemName).join(', ')} — add it on the Items page to include these in the calculation.
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <DataTable
              columns={ingotColumns}
              data={ingotDispatches}
              title="Ingot Dispatches"
              addButtonLabel="Record Ingot Dispatch"
              onAdd={handleAddIngot}
              onEdit={handleEditIngot}
              onDelete={handleDeleteIngot}
              canMutate={canMutate}
            />
          </div>
        </TabsContent>

        <TabsContent value="dies">
          <div className="space-y-3">
            <div className="flex justify-end">
              {canMutate && (
                <Button size="sm" onClick={handleAddDie} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Die
                </Button>
              )}
            </div>

            {diesByVendor.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No dies recorded yet.</p>
            ) : (
              diesByVendor.map(group => (
                <Collapsible
                  key={group.casterId}
                  open={expandedDieVendors.has(group.casterId)}
                  onOpenChange={() => toggleDieVendor(group.casterId)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="w-full text-left">
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                          <div>
                            <CardTitle className="text-base">{group.casterName}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {group.dies.length} {group.dies.length === 1 ? 'die' : 'dies'} ·{' '}
                              {group.dies.filter(d => d.status === 'active').length} active
                            </p>
                          </div>
                          {expandedDieVendors.has(group.casterId) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </CardHeader>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <DataTable
                          columns={dieColumns.filter(c => c.key !== 'caster_name')}
                          data={group.dies}
                          title="Dies"
                          searchable={false}
                          onEdit={handleEditDie}
                          onDelete={handleDeleteDie}
                          canMutate={canMutate}
                        />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="reworks">
          <DataTable
            columns={reworkColumns}
            data={allReworks}
            title="Reworks (1:1 Replacements)"
            addButtonLabel="Record Rework"
            onAdd={handleAddRework}
            onEdit={handleEditRework}
            onDelete={handleDeleteRework}
            canMutate={canMutate}
          />
        </TabsContent>

        <TabsContent value="statements">
          <DataTable
            columns={statementColumns}
            data={allStatements}
            title="Monthly Metal Statements"
            addButtonLabel="New Statement"
            onAdd={handleAddStatement}
            onEdit={handleEditStatement}
            onDelete={handleDeleteStatement}
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
        title={editingCaster ? 'Edit Vendor' : 'Add New Vendor'}
        fields={casterFields}
        initialData={editingCaster || { status: 'active', vendor_type: 'caster' }}
        submitLabel={editingCaster ? 'Update Vendor' : 'Add Vendor'}
      />

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Vendor"
        description={`Are you sure you want to delete "${casterToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
      />

      <PurchaseOrderModal
        isOpen={isPOModalOpen}
        onOpenChange={setIsPOModalOpen}
        editingPO={editingPO}
        casters={casters}
        items={items}
        dies={allDies}
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

      <FormModal
        isOpen={isIngotModalOpen}
        onClose={() => {
          setIsIngotModalOpen(false);
          setEditingIngot(null);
        }}
        onSubmit={handleSubmitIngot}
        title={editingIngot ? 'Edit Ingot Dispatch' : 'Record Ingot Dispatch'}
        fields={ingotFieldsFor(casters)}
        initialData={
          editingIngot
            ? { ...editingIngot, caster_id: editingIngot.caster_id.toString() }
            : { dispatch_date: new Date().toISOString().split('T')[0], material_type: 'ingot' }
        }
        submitLabel={editingIngot ? 'Update Dispatch' : 'Record Dispatch'}
      />

      <ConfirmDialog
        open={isIngotDeleteConfirmOpen}
        onOpenChange={setIsIngotDeleteConfirmOpen}
        onConfirm={confirmDeleteIngot}
        title="Delete Ingot Dispatch"
        description="Are you sure you want to delete this ingot dispatch record? This action cannot be undone."
        confirmText="Delete"
      />

      <FormModal
        isOpen={isDieModalOpen}
        onClose={() => { setIsDieModalOpen(false); setEditingDie(null); }}
        onSubmit={handleSubmitDie}
        title={editingDie ? 'Edit Die' : 'Add Die'}
        fields={dieFieldsFor(casters, items)}
        initialData={
          editingDie
            ? { ...editingDie, caster_id: editingDie.caster_id.toString(), item_id: editingDie.item_id.toString() }
            : { mould_type: 'casting', status: 'active', shot_count: '0' }
        }
        submitLabel={editingDie ? 'Update Die' : 'Add Die'}
      />
      <ConfirmDialog
        open={isDieDeleteConfirmOpen}
        onOpenChange={setIsDieDeleteConfirmOpen}
        onConfirm={confirmDeleteDie}
        title="Delete Die"
        description="Are you sure you want to delete this die record? This action cannot be undone."
        confirmText="Delete"
      />

      <FormModal
        isOpen={isReworkModalOpen}
        onClose={() => { setIsReworkModalOpen(false); setEditingRework(null); }}
        onSubmit={handleSubmitRework}
        title={editingRework ? 'Edit Rework' : 'Record Rework'}
        fields={reworkFieldsFor(casters, items)}
        initialData={
          editingRework
            ? { ...editingRework, caster_id: editingRework.caster_id.toString(), item_id: editingRework.item_id.toString() }
            : { sent_date: new Date().toISOString().split('T')[0], status: 'pending', quantity_replaced: '0' }
        }
        submitLabel={editingRework ? 'Update Rework' : 'Record Rework'}
      />
      <ConfirmDialog
        open={isReworkDeleteConfirmOpen}
        onOpenChange={setIsReworkDeleteConfirmOpen}
        onConfirm={confirmDeleteRework}
        title="Delete Rework"
        description="Are you sure you want to delete this rework record? This action cannot be undone."
        confirmText="Delete"
      />

      <StatementModal
        isOpen={isStatementModalOpen}
        onOpenChange={setIsStatementModalOpen}
        editingStatement={editingStatement}
        casters={casters}
        onSubmit={handleSubmitStatement}
        isPending={createStatementMutation.isPending || updateStatementMutation.isPending}
      />
      <ConfirmDialog
        open={isStatementDeleteConfirmOpen}
        onOpenChange={setIsStatementDeleteConfirmOpen}
        onConfirm={confirmDeleteStatement}
        title="Delete Statement"
        description="Are you sure you want to delete this statement? This action cannot be undone."
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
  const sortByAgeing = (a: POWithDetails, b: POWithDetails) =>
    new Date(a.order_date).getTime() - new Date(b.order_date).getTime(); // oldest first — most overdue surfaces first
  const confirmedPOs = purchaseOrders.filter(po => po.status === 'confirmed').sort(sortByAgeing);
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

function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24)));
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
  const overallFillRate = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  const ageing = daysSince(po.order_date);
  const isStale = po.status !== 'completed' && ageing > 30 && overallFillRate < 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">{po.po_number}</CardTitle>
            <Badge variant={po.status === 'completed' ? 'secondary' : 'default'} className="text-xs">
              {po.status}
            </Badge>
            {po.status !== 'completed' && (
              <Badge variant={isStale ? 'destructive' : 'outline'} className="text-xs">
                {ageing} {ageing === 1 ? 'day' : 'days'} old
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{po.caster_name}</span>
            {canMutate && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(po)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(po)} className="text-destructive">
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
            {totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()} received ({overallFillRate}% fill rate)
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
                <th className="text-right py-1.5 px-3 font-medium">Fill Rate</th>
                <th className="text-right py-1.5 px-3 font-medium">Ageing</th>
              </tr>
            </thead>
            <tbody>
              {po.line_items.map(item => {
                const remaining = Math.max(0, item.quantity_ordered - item.quantity_received);
                const fillRate = item.quantity_ordered > 0 ? Math.round((item.quantity_received / item.quantity_ordered) * 100) : 0;
                return (
                  <tr key={item.id} className="border-t">
                    <td className="py-1.5 px-3">{item.item_name}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{item.quantity_ordered.toLocaleString()}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{item.quantity_received.toLocaleString()}</td>
                    <td className={`py-1.5 px-3 text-right font-mono ${remaining > 0 ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}`}>
                      {remaining.toLocaleString()}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono">{fillRate}%</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {po.status === 'completed' ? '—' : `${ageing}d`}
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
            const fillRate = item.quantity_ordered > 0 ? Math.round((item.quantity_received / item.quantity_ordered) * 100) : 0;
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
                <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                  <div>
                    <span className="text-muted-foreground text-xs">Fill Rate</span>
                    <div className="font-mono">{fillRate}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Ageing</span>
                    <div className="font-mono">{po.status === 'completed' ? '—' : `${ageing}d`}</div>
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
  dies,
  onSubmit,
  isPending,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingPO: POWithDetails | null;
  casters: Caster[];
  items: Item[];
  dies: DieWithNames[];
  onSubmit: (data: POFormData) => void;
  isPending: boolean;
}) {
  // Defaults to showing only SKUs this caster has an active casting die for —
  // falls back to all items if die records are incomplete for this caster.
  const [showAllItems, setShowAllItems] = useState(false);

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
  const selectedCasterId = form.watch('caster_id');

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

  const getAvailableItems = (currentIndex: number) => {
    const selectedItemIds = lineItems
      .map((li, idx) => (idx !== currentIndex ? li.item_id : null))
      .filter((id) => id !== null && id !== '');
    let candidates = items.filter(i => i.is_active && !selectedItemIds.includes(i.id.toString()));

    if (!showAllItems && selectedCasterId) {
      const casterDieItemIds = new Set(
        dies
          .filter(d => d.caster_id === parseInt(selectedCasterId) && d.mould_type === 'casting' && d.status === 'active')
          .map(d => d.item_id)
      );
      // Only narrow the list if this caster actually has die records — an
      // empty set here almost always means dies haven't been entered yet for
      // them, not that they can't cast anything, so we fall back to showing
      // everything rather than presenting an empty/misleading dropdown.
      if (casterDieItemIds.size > 0) {
        candidates = candidates.filter(i => casterDieItemIds.has(i.id));
      }
    }

    return candidates;
  };

  const selectedCasterHasDies = !!selectedCasterId && dies.some(
    d => d.caster_id === parseInt(selectedCasterId) && d.mould_type === 'casting' && d.status === 'active'
  );

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
                    <FormLabel>Vendor</FormLabel>
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

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <FormLabel className="text-base font-semibold">Items & Quantities</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="gap-1">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {selectedCasterId && (
                <p className="text-xs text-muted-foreground mb-2">
                  {showAllItems ? (
                    <>Showing all items. <button type="button" className="underline" onClick={() => setShowAllItems(false)}>Show only this caster's dies</button></>
                  ) : selectedCasterHasDies ? (
                    <>Showing only SKUs this caster has an active die for. <button type="button" className="underline" onClick={() => setShowAllItems(true)}>Show all items</button></>
                  ) : (
                    <>No die records found for this caster yet, showing all items.</>
                  )}
                </p>
              )}

              <div className="space-y-2 max-w-md">
                {lineItems.length > 0 && (
                  <div className="flex gap-2 items-center px-2 pb-1 text-xs font-medium text-muted-foreground">
                    <div className="flex-1">Item</div>
                    <div className="w-24">Quantity</div>
                    <div className="w-9"></div>
                  </div>
                )}

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
                              {getAvailableItems(index).map(item => (
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

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {lineItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No items added yet. Click "Add Item" to add products.
                  </p>
                )}
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

function StatementModal({
  isOpen,
  onOpenChange,
  editingStatement,
  casters,
  onSubmit,
  isPending,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingStatement: StatementWithCasterName | null;
  casters: Caster[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [casterId, setCasterId] = useState('');
  const [periodMonth, setPeriodMonth] = useState(defaultMonth);
  const [calculated, setCalculated] = useState<{
    openingBalanceKg: number;
    dispatchedKg: number;
    expectedMetalConsumedKg: number;
    actualFinishedWeightKg: number;
    closingBalanceKg: number;
    itemsMissingWeight: Array<{ itemId: number; itemName: string }>;
  } | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [vendorReportedProduced, setVendorReportedProduced] = useState('');
  const [vendorReportedReceived, setVendorReportedReceived] = useState('');
  const [vendorReportedRemaining, setVendorReportedRemaining] = useState('');
  const [status, setStatus] = useState('draft');
  const [sentDate, setSentDate] = useState('');
  const [ackDate, setAckDate] = useState('');
  const [notes, setNotes] = useState('');

  // Reset/populate form whenever the modal opens, for either a fresh
  // statement or editing an existing one
  useEffect(() => {
    if (!isOpen) return;
    if (editingStatement) {
      setCasterId(editingStatement.caster_id.toString());
      setPeriodMonth(editingStatement.period_month);
      setCalculated({
        openingBalanceKg: editingStatement.opening_balance_kg,
        dispatchedKg: editingStatement.dispatched_kg,
        expectedMetalConsumedKg: editingStatement.expected_received_kg,
        actualFinishedWeightKg: editingStatement.actual_received_kg,
        closingBalanceKg: editingStatement.closing_balance_kg,
        itemsMissingWeight: [], // not re-derived for a saved statement; hit Calculate again if you need a fresh check
      });
      setVendorReportedProduced(editingStatement.vendor_reported_produced_kg?.toString() || '');
      setVendorReportedReceived(editingStatement.vendor_reported_received_kg?.toString() || '');
      setVendorReportedRemaining(editingStatement.vendor_reported_remaining_kg?.toString() || '');
      setStatus(editingStatement.status);
      setSentDate(editingStatement.sent_date || '');
      setAckDate(editingStatement.ack_date || '');
      setNotes(editingStatement.notes || '');
    } else {
      setCasterId('');
      setPeriodMonth(defaultMonth);
      setCalculated(null);
      setVendorReportedProduced('');
      setVendorReportedReceived('');
      setVendorReportedRemaining('');
      setStatus('draft');
      setSentDate('');
      setAckDate('');
      setNotes('');
    }
    setCalcError(null);
  }, [isOpen, editingStatement]);

  const handleCalculate = async () => {
    if (!casterId || !periodMonth) return;
    setCalculating(true);
    setCalcError(null);
    try {
      const res = await fetch(`/api/casters/${casterId}/metal-statement-calc?month=${periodMonth}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to calculate — check the caster and month are valid');
      const data = await res.json();
      setCalculated(data);
    } catch (err: any) {
      setCalcError(err.message || 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = () => {
    if (!calculated || !casterId || !periodMonth) return;
    onSubmit({
      caster_id: parseInt(casterId),
      period_month: periodMonth,
      opening_balance_kg: calculated.openingBalanceKg,
      dispatched_kg: calculated.dispatchedKg,
      expected_received_kg: calculated.expectedMetalConsumedKg,
      actual_received_kg: calculated.actualFinishedWeightKg,
      closing_balance_kg: calculated.closingBalanceKg,
      vendor_reported_produced_kg: vendorReportedProduced ? parseFloat(vendorReportedProduced) : null,
      vendor_reported_received_kg: vendorReportedReceived ? parseFloat(vendorReportedReceived) : null,
      vendor_reported_remaining_kg: vendorReportedRemaining ? parseFloat(vendorReportedRemaining) : null,
      status,
      sent_date: sentDate || null,
      ack_date: ackDate || null,
      notes: notes || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingStatement ? 'Edit Statement' : 'New Monthly Statement'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Vendor</label>
              <Select value={casterId} onValueChange={setCasterId} disabled={!!editingStatement}>
                <SelectTrigger><SelectValue placeholder="Select caster" /></SelectTrigger>
                <SelectContent>
                  {casters.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Month</label>
              <Input type="month" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)} disabled={!!editingStatement} />
            </div>
          </div>

          <div>
            <Button type="button" variant="outline" size="sm" onClick={handleCalculate} disabled={!casterId || !periodMonth || calculating}>
              {calculating ? 'Calculating...' : editingStatement ? 'Recalculate' : 'Calculate'}
            </Button>
            {editingStatement && (
              <p className="text-xs text-muted-foreground mt-1">
                Recalculating refreshes the figures below from the latest castings/materials on record — it won't touch the vendor-reported fields, status, or notes you've already entered.
              </p>
            )}
          </div>
          {calcError && <p className="text-sm text-destructive">{calcError}</p>}

          {calculated && (
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Onyx's calculated figures (for this month)</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Opening balance: <span className="font-mono">{formatWeightKg(calculated.openingBalanceKg)}</span></div>
                <div>Dispatched: <span className="font-mono">{formatWeightKg(calculated.dispatchedKg)}</span></div>
                <div>Metal consumed (expected): <span className="font-mono">{formatWeightKg(calculated.expectedMetalConsumedKg)}</span></div>
                <div>Finished weight received: <span className="font-mono">{formatWeightKg(calculated.actualFinishedWeightKg)}</span></div>
                <div className="col-span-2 font-medium">Closing balance: <span className="font-mono">{formatWeightKg(calculated.closingBalanceKg)}</span></div>
              </div>
              {calculated.itemsMissingWeight.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500 pt-1">
                  Missing "Finished Weight" on: {calculated.itemsMissingWeight.map(i => i.itemName).join(', ')} — these SKUs are excluded from the figures above until you add it on the Items page.
                </p>
              )}
            </div>
          )}

          {calculated && (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Vendor's own reported figures (optional — only if this caster sends their own report)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs mb-1 block">Produced (kg)</label>
                    <Input type="number" value={vendorReportedProduced} onChange={e => setVendorReportedProduced(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block">Received (kg)</label>
                    <Input type="number" value={vendorReportedReceived} onChange={e => setVendorReportedReceived(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block">Remaining (kg)</label>
                    <Input type="number" value={vendorReportedRemaining} onChange={e => setVendorReportedRemaining(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Sent Date</label>
                  <Input type="date" value={sentDate} onChange={e => setSentDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Ack. Date</label>
                  <Input type="date" value={ackDate} onChange={e => setAckDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Notes</label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any discrepancy notes, etc." />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={!calculated || isPending}>
              {isPending ? 'Saving...' : editingStatement ? 'Update Statement' : 'Save Statement'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
