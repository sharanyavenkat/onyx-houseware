import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
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

export default function Customers() {
  const [customers, setCustomers] = useState(mockCustomers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  const handleAdd = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = (customer: any) => {
    console.log('Delete customer:', customer);
    setCustomers(customers.filter(c => c.id !== customer.id));
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
    </div>
  );
}