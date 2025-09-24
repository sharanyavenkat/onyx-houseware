import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

// Current Onyx Houseware product catalog
const mockItems = [
  { id: 1, name: 'Tawa', sku: 'TWA-280', product_type: 'Cookware', size_specification: '280mm', price: 850.00, safety_stock: 20, is_active: true },
  { id: 2, name: 'Fry Pan', sku: 'FP-240', product_type: 'Cookware', size_specification: '240mm', price: 650.00, safety_stock: 15, is_active: true },
  { id: 3, name: 'Kadai', sku: 'KD-240', product_type: 'Cookware', size_specification: '240mm', price: 750.00, safety_stock: 15, is_active: true },
  { id: 4, name: 'Casserole', sku: 'CS-220', product_type: 'Cookware', size_specification: '220mm', price: 950.00, safety_stock: 10, is_active: true },
  { id: 5, name: 'Casserole', sku: 'CS-240', product_type: 'Cookware', size_specification: '240mm', price: 1050.00, safety_stock: 10, is_active: true },
  { id: 6, name: 'Paniyaram', sku: 'PN-12', product_type: 'Cookware', size_specification: '12 pits', price: 450.00, safety_stock: 8, is_active: true },
  { id: 7, name: 'Paniyaram', sku: 'PN-7', product_type: 'Cookware', size_specification: '7 pits', price: 350.00, safety_stock: 5, is_active: false, notes: 'Still developing' },
  { id: 8, name: 'Appachety', sku: 'AP-01', product_type: 'Cookware', size_specification: 'Standard', price: 400.00, safety_stock: 12, is_active: true }
];

const itemFields = [
  { name: 'name', label: 'Product Name', type: 'text' as const, required: true, placeholder: 'Enter product name' },
  { name: 'sku', label: 'SKU', type: 'text' as const, placeholder: 'Enter SKU code' },
  { name: 'product_type', label: 'Product Type', type: 'select' as const, required: true, options: [
    { value: 'Cookware', label: 'Cookware' },
    { value: 'Utensils', label: 'Utensils' },
    { value: 'Accessories', label: 'Accessories' }
  ]},
  { name: 'size_specification', label: 'Size/Specification', type: 'text' as const, placeholder: 'e.g., 280mm, 12 pits, Standard' },
  { name: 'price', label: 'Price (₹)', type: 'number' as const, placeholder: '0.00' },
  { name: 'safety_stock', label: 'Safety Stock', type: 'number' as const, placeholder: '0', required: true },
  { name: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Additional notes (e.g., still developing)...' }
];

const itemColumns = [
  { key: 'name', label: 'Product Name' },
  { key: 'sku', label: 'SKU' },
  { key: 'product_type', label: 'Type' },
  { key: 'size_specification', label: 'Size/Spec' },
  { key: 'price', label: 'Price', render: (value: number) => value ? `₹${value.toFixed(2)}` : '-' },
  { key: 'safety_stock', label: 'Safety Stock' },
  { 
    key: 'is_active', 
    label: 'Status', 
    render: (value: boolean) => (
      <Badge variant={value ? 'default' : 'secondary'}>
        {value ? 'Active' : 'Inactive'}
      </Badge>
    )
  }
];

export default function Items() {
  const [items, setItems] = useState(mockItems);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (item: any) => {
    console.log('Delete item:', item);
    setItems(items.filter(i => i.id !== item.id));
  };

  const handleSubmit = (data: any) => {
    if (editingItem) {
      // Edit existing item
      setItems(items.map(item => 
        item.id === editingItem.id ? { ...item, ...data } : item
      ));
    } else {
      // Add new item
      const newItem = {
        id: Math.max(...items.map(i => i.id)) + 1,
        ...data,
        is_active: true
      };
      setItems([...items, newItem]);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6" data-testid="page-items">
      <DataTable 
        columns={itemColumns}
        data={items}
        title="Items"
        addButtonLabel="Add Item"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      
      <FormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmit}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
        fields={itemFields}
        initialData={editingItem || {}}
        submitLabel={editingItem ? 'Update Item' : 'Add Item'}
      />
    </div>
  );
}