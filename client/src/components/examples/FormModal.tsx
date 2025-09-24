import FormModal from '../FormModal';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

// TODO: Remove mock data functionality
const mockFields = [
  { name: 'name', label: 'Name', type: 'text' as const, required: true, placeholder: 'Enter item name' },
  { name: 'sku', label: 'SKU', type: 'text' as const, placeholder: 'Enter SKU' },
  { name: 'product_type', label: 'Product Type', type: 'select' as const, required: true, options: [
    { value: 'steel', label: 'Steel' },
    { value: 'aluminum', label: 'Aluminum' },
    { value: 'copper', label: 'Copper' },
    { value: 'brass', label: 'Brass' }
  ]},
  { name: 'price', label: 'Price', type: 'number' as const, placeholder: '0.00' },
  { name: 'safety_stock', label: 'Safety Stock', type: 'number' as const, placeholder: '0' },
  { name: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Additional notes...' }
];

export default function FormModalExample() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="p-6">
      <Button onClick={() => setIsOpen(true)}>Open Form Modal</Button>
      
      <FormModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={(data) => {
          console.log('Form submitted:', data);
          setIsOpen(false);
        }}
        title="Add New Item"
        fields={mockFields}
        submitLabel="Add Item"
      />
    </div>
  );
}