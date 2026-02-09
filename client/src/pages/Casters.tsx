import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import type { Caster } from '@shared/schema';

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

export default function Casters() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaster, setEditingCaster] = useState<Caster | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [casterToDelete, setCasterToDelete] = useState<Caster | null>(null);
  const { toast } = useToast();
  const { canMutate } = useAuth();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const monthOptions = useMemo(() => getMonthOptions(), []);

  const { data: casters = [] } = useQuery<Caster[]>({
    queryKey: ['/api/casters'],
  });

  const { data: monthlyReport = {}, isLoading: reportLoading } = useQuery<MonthlyReport>({
    queryKey: [`/api/batches/monthly-report?month=${selectedMonth}`],
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

  return (
    <div className="space-y-6" data-testid="page-casters">
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
              {castersWithData.map(({ casterId, casterName, items, totalReceived, totalRejected, totalBatches }) => (
                <div key={casterId} className="border rounded-lg">
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <h3 className="font-semibold">{casterName}</h3>
                      <div className="text-sm text-muted-foreground">
                        {totalBatches} batch{totalBatches !== 1 ? 'es' : ''} — {totalReceived.toLocaleString()} pcs received
                        {totalRejected > 0 && (
                          <span className="text-destructive ml-1">
                            ({totalRejected.toLocaleString()} rejected)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop Table */}
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
                        {items.map(item => (
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

                  {/* Mobile Cards */}
                  <div className="sm:hidden divide-y">
                    {items.map(item => (
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
    </div>
  );
}
