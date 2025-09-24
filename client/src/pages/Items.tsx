import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

// TODO: Remove mock data functionality
const mockItems = [
  { id: 1, name: 'Steel Plate 10mm', sku: 'SP-10', product_type: 'Steel', size_mm: 10, price: 25.50, safety_stock: 50, is_active: true },
  { id: 2, name: 'Aluminum Sheet', sku: 'AS-01', product_type: 'Aluminum', size_mm: 5, price: 15.75, safety_stock: 30, is_active: true },
  { id: 3, name: 'Copper Wire', sku: 'CW-05', product_type: 'Copper', size_mm: 2, price: 8.25, safety_stock: 25, is_active: false },
  { id: 4, name: 'Brass Fitting', sku: 'BF-12', product_type: 'Brass', size_mm: 15, price: 12.00, safety_stock: 15, is_active: true }
];

const itemFields = [
  { name: 'name', label: 'Name', type: 'text' as const, required: true, placeholder: 'Enter item name' },
  { name: 'sku', label: 'SKU', type: 'text' as const, placeholder: 'Enter SKU (optional)' },
  { name: 'product_type', label: 'Product Type', type: 'select' as const, required: true, options: [
    { value: 'steel', label: 'Steel' },
    { value: 'aluminum', label: 'Aluminum' },
    { value: 'copper', label: 'Copper' },
    { value: 'brass', label: 'Brass' }
  ]},
  { name: 'size_mm', label: 'Size (mm)', type: 'number' as const, placeholder: 'Size in millimeters' },
  { name: 'ib_plate_size', label: 'IB Plate Size', type: 'text' as const, placeholder: 'IB plate size (optional)' },
  { name: 'price', label: 'Price', type: 'number' as const, placeholder: '0.00' },
  { name: 'safety_stock', label: 'Safety Stock', type: 'number' as const, placeholder: '0', required: true },
  { name: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Additional notes...' }
];

const itemColumns = [
  { key: 'name', label: 'Name' },
  { key: 'sku', label: 'SKU' },
  { key: 'product_type', label: 'Type' },
  { key: 'size_mm', label: 'Size (mm)' },
  { key: 'price', label: 'Price', render: (value: number) => value ? `$${value.toFixed(2)}` : '-' },
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