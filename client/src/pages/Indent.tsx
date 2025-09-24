import DataTable from '../components/DataTable';
import MonthPicker from '../components/MonthPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';
import { useState } from 'react';

// TODO: Remove mock data functionality
const mockIndentData = [
  { 
    id: 1, 
    item_name: 'Steel Plate 10mm', 
    opening_balance: 100, 
    expected_receipts: 50, 
    pending_order_qty: 120, 
    safety_stock: 50,
    required_to_order: 20 // max(0, (120 + 50) - (100 + 50))
  },
  { 
    id: 2, 
    item_name: 'Aluminum Sheet', 
    opening_balance: 75, 
    expected_receipts: 25, 
    pending_order_qty: 85, 
    safety_stock: 30,
    required_to_order: 15 // max(0, (85 + 30) - (75 + 25))
  },
  { 
    id: 3, 
    item_name: 'Copper Wire', 
    opening_balance: 60, 
    expected_receipts: 30, 
    pending_order_qty: 45, 
    safety_stock: 25,
    required_to_order: 0 // max(0, (45 + 25) - (60 + 30))
  }
];

export default function Indent() {
  const [selectedMonth, setSelectedMonth] = useState('2025-01');
  const [indentData, setIndentData] = useState(mockIndentData);
  const [editingCells, setEditingCells] = useState<Record<string, any>>({});

  const calculateRequiredToOrder = (pendingQty: number, safetyStock: number, openingBalance: number, expectedReceipts: number) => {
    return Math.max(0, (pendingQty + safetyStock) - (openingBalance + expectedReceipts));
  };

  const handleCellEdit = (rowId: number, field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const key = `${rowId}-${field}`;
    setEditingCells(prev => ({ ...prev, [key]: numValue }));

    // Update the data and recalculate
    setIndentData(prev => prev.map(item => {
      if (item.id === rowId) {
        const updated = { ...item, [field]: numValue };
        updated.required_to_order = calculateRequiredToOrder(
          updated.pending_order_qty,
          updated.safety_stock,
          updated.opening_balance,
          updated.expected_receipts
        );
        return updated;
      }
      return item;
    }));
  };

  const handleSave = () => {
    console.log('Saving indent data:', indentData);
    setEditingCells({});
    // TODO: Implement actual save functionality
  };

  const indentColumns = [
    { key: 'item_name', label: 'Item Name' },
    { 
      key: 'opening_balance', 
      label: 'Opening Balance', 
      render: (value: number, row: any) => (
        <Input
          type="number"
          value={editingCells[`${row.id}-opening_balance`] ?? value}
          onChange={(e) => handleCellEdit(row.id, 'opening_balance', e.target.value)}
          className="w-24"
          data-testid={`input-opening-balance-${row.id}`}
        />
      )
    },
    { 
      key: 'expected_receipts', 
      label: 'Expected Receipts', 
      render: (value: number, row: any) => (
        <Input
          type="number"
          value={editingCells[`${row.id}-expected_receipts`] ?? value}
          onChange={(e) => handleCellEdit(row.id, 'expected_receipts', e.target.value)}
          className="w-24"
          data-testid={`input-expected-receipts-${row.id}`}
        />
      )
    },
    { key: 'pending_order_qty', label: 'Pending Orders' },
    { key: 'safety_stock', label: 'Safety Stock' },
    { 
      key: 'required_to_order', 
      label: 'Required to Order', 
      render: (value: number) => (
        <span className={`font-semibold ${value > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {value}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6" data-testid="page-indent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-indent-title">Indent Management</h1>
          <p className="text-muted-foreground">Manage monthly inventory requirements</p>
        </div>
        <div className="flex items-center gap-4">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <Button onClick={handleSave} data-testid="button-save-indent">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Formula Explanation */}
      <div className="bg-muted/50 p-4 rounded-lg border">
        <h3 className="font-medium mb-2">Calculation Formula:</h3>
        <p className="text-sm text-muted-foreground">
          <strong>Required to Order</strong> = max(0, (Pending Orders + Safety Stock) - (Opening Balance + Expected Receipts))
        </p>
      </div>

      {/* Indent Table */}
      <DataTable 
        columns={indentColumns}
        data={indentData}
        title="Monthly Indent Report"
        searchable={false}
      />
    </div>
  );
}