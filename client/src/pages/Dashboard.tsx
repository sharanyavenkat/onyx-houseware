import DashboardCards from '../components/DashboardCards';
import DataTable from '../components/DataTable';
import MonthPicker from '../components/MonthPicker';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

// TODO: Remove mock data functionality
const mockTopItems = [
  { name: 'Steel Plate 10mm', pendingQty: 120, safetyStock: 50, status: 'Critical' },
  { name: 'Aluminum Sheet', pendingQty: 85, safetyStock: 30, status: 'Low' },
  { name: 'Copper Wire', pendingQty: 45, safetyStock: 25, status: 'Good' },
  { name: 'Brass Fitting', pendingQty: 30, safetyStock: 15, status: 'Good' }
];

const topItemsColumns = [
  { key: 'name', label: 'Item Name' },
  { key: 'pendingQty', label: 'Pending Qty' },
  { key: 'safetyStock', label: 'Safety Stock' },
  { 
    key: 'status', 
    label: 'Status', 
    render: (value: string) => {
      const variant = value === 'Critical' ? 'destructive' : value === 'Low' ? 'secondary' : 'default';
      return <Badge variant={variant}>{value}</Badge>;
    }
  }
];

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState('2025-01');

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your order management system</p>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Cards */}
      <DashboardCards />

      {/* Top Items by Pending Quantity */}
      <DataTable 
        columns={topItemsColumns}
        data={mockTopItems}
        title="Top Items by Pending Quantity"
        searchable={false}
      />
    </div>
  );
}