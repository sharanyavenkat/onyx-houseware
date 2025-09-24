import DataTable from '../DataTable';
import { Badge } from '@/components/ui/badge';

// TODO: Remove mock data functionality
const mockColumns = [
  { key: 'name', label: 'Name' },
  { key: 'sku', label: 'SKU' },
  { key: 'type', label: 'Type' },
  { key: 'price', label: 'Price', render: (value: number) => `$${value?.toFixed(2) || '0.00'}` },
  { 
    key: 'status', 
    label: 'Status', 
    render: (value: string) => (
      <Badge variant={value === 'active' ? 'default' : 'secondary'}>
        {value}
      </Badge>
    )
  }
];

const mockData = [
  { id: 1, name: 'Steel Plate 10mm', sku: 'SP-10', type: 'Steel', price: 25.50, status: 'active' },
  { id: 2, name: 'Aluminum Sheet', sku: 'AS-01', type: 'Aluminum', price: 15.75, status: 'active' },
  { id: 3, name: 'Copper Wire', sku: 'CW-05', type: 'Copper', price: 8.25, status: 'inactive' },
  { id: 4, name: 'Brass Fitting', sku: 'BF-12', type: 'Brass', price: 12.00, status: 'active' }
];

export default function DataTableExample() {
  return (
    <div className="p-6">
      <DataTable 
        columns={mockColumns}
        data={mockData}
        title="Items"
        addButtonLabel="Add Item"
        onAdd={() => console.log('Add item')}
        onEdit={(item) => console.log('Edit item:', item)}
        onDelete={(item) => console.log('Delete item:', item)}
      />
    </div>
  );
}