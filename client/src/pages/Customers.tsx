import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@shared/schema';

const customerFields = [
  { name: 'company_name', label: 'Company Name', type: 'text' as const, required: true, placeholder: 'Enter company name' },
  { name: 'contact_person', label: 'Contact Person', type: 'text' as const, required: true, placeholder: 'Contact person name' },
  { name: 'email', label: 'Email', type: 'email' as const, required: true, placeholder: 'company@example.com' },
  { name: 'phone', label: 'Phone', type: 'text' as const, required: true, placeholder: '555-0000' },
  { name: 'po_number', label: 'PO Number', type: 'text' as const, placeholder: 'Customer PO number (optional)' },
  { name: 'address', label: 'Address', type: 'textarea' as const, required: true, placeholder: 'Complete address...' },
];

const customerColumns = [
  { key: 'company_name', label: 'Company' },
  { key: 'contact_person', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'po_number', label: 'PO Number', render: (value: string) => value || '-' }
];

export default function Customers() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const { toast } = useToast();

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/customers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({ title: 'Customer created successfully' });
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating customer', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({ title: 'Customer updated successfully' });
      setIsModalOpen(false);
      setEditingCustomer(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating customer', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({ title: 'Customer deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting customer', description: error.message, variant: 'destructive' });
    },
  });

  const handleAdd = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      deleteMutation.mutate(customerToDelete.id);
      setIsConfirmOpen(false);
      setCustomerToDelete(null);
    }
  };

  const handleSubmit = (data: any) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-customers">
      <DataTable 
        columns={customerColumns}
        data={customers}
        title="Customers"
        addButtonLabel="Add Customer"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      
      <FormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCustomer(null);
        }}
        onSubmit={handleSubmit}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        fields={customerFields}
        initialData={editingCustomer || {}}
        submitLabel={editingCustomer ? 'Update Customer' : 'Add Customer'}
      />

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Customer"
        description={`Are you sure you want to delete "${customerToDelete?.company_name}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}