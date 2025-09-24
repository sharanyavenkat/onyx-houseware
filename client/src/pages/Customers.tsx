import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { useState } from 'react';

// TODO: Remove mock data functionality
const mockCustomers = [
  { id: 1, name: 'ABC Manufacturing', contact_name: 'John Smith', email: 'john@abc.com', phone: '555-0101', po_number: 'PO-2025-001' },
  { id: 2, name: 'XYZ Industries', contact_name: 'Jane Doe', email: 'jane@xyz.com', phone: '555-0102', po_number: 'PO-2025-002' },
  { id: 3, name: 'Metal Works Inc', contact_name: 'Bob Johnson', email: 'bob@metalworks.com', phone: '555-0103', po_number: 'PO-2025-003' }
];

const customerFields = [
  { name: 'name', label: 'Company Name', type: 'text' as const, required: true, placeholder: 'Enter company name' },
  { name: 'contact_name', label: 'Contact Name', type: 'text' as const, placeholder: 'Contact person name' },
  { name: 'email', label: 'Email', type: 'email' as const, placeholder: 'company@example.com' },
  { name: 'phone', label: 'Phone', type: 'text' as const, placeholder: '555-0000' },
  { name: 'gstin', label: 'GSTIN', type: 'text' as const, placeholder: 'GST identification number' },
  { name: 'po_number', label: 'PO Number', type: 'text' as const, required: true, placeholder: 'Unique PO number' },
  { name: 'billing_address', label: 'Billing Address', type: 'textarea' as const, placeholder: 'Billing address...' },
  { name: 'shipping_address', label: 'Shipping Address', type: 'textarea' as const, placeholder: 'Shipping address...' },
  { name: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Additional notes...' }
];

const customerColumns = [
  { key: 'name', label: 'Company' },
  { key: 'contact_name', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'po_number', label: 'PO Number' }
];

// Mock orders data to check dependencies
const mockOrders = [
  { id: 1, customer_name: 'ABC Manufacturing', status: 'draft' },
  { id: 2, customer_name: 'XYZ Industries', status: 'confirmed' },
  { id: 3, customer_name: 'Metal Works Inc', status: 'fulfilled' },
  { id: 4, customer_name: 'ABC Manufacturing', status: 'cancelled' }
];

export default function Customers() {
  const [customers, setCustomers] = useState(mockCustomers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {} });

  const handleAdd = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = (customer: any) => {
    // Check for unfulfilled orders
    const unfulfilledOrders = mockOrders.filter(
      order => order.customer_name === customer.name && 
      !['fulfilled', 'cancelled'].includes(order.status)
    );
    
    let title = 'Delete Customer';
    let description = `Are you sure you want to delete "${customer.name}"? This action cannot be undone.`;
    
    if (unfulfilledOrders.length > 0) {
      title = 'Warning: Customer Has Unfulfilled Orders';
      description = `"${customer.name}" has ${unfulfilledOrders.length} unfulfilled order(s). Deleting this customer will also remove all non-fulfilled orders. Are you sure you want to proceed?`;
    }
    
    setConfirmationDialog({
      isOpen: true,
      title,
      description,
      onConfirm: () => {
        console.log('Delete customer:', customer);
        // In a real app, this would also delete related unfulfilled orders
        setCustomers(customers.filter(c => c.id !== customer.id));
      }
    });
  };

  const handleSubmit = (data: any) => {
    if (editingCustomer) {
      // Edit existing customer
      setCustomers(customers.map(customer => 
        customer.id === editingCustomer.id ? { ...customer, ...data } : customer
      ));
    } else {
      // Add new customer
      const newCustomer = {
        id: Math.max(...customers.map(c => c.id)) + 1,
        ...data
      };
      setCustomers([...customers, newCustomer]);
    }
    setIsModalOpen(false);
    setEditingCustomer(null);
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
      
      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        onClose={() => setConfirmationDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmationDialog.onConfirm}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
        confirmLabel="Delete Customer"
        isDestructive={true}
      />
    </div>
  );
}