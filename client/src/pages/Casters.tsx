import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useState } from 'react';
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

export default function Casters() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaster, setEditingCaster] = useState<Caster | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [casterToDelete, setCasterToDelete] = useState<Caster | null>(null);
  const { toast } = useToast();
  const { canMutate } = useAuth();

  const { data: casters = [] } = useQuery<Caster[]>({
    queryKey: ['/api/casters'],
  });

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
