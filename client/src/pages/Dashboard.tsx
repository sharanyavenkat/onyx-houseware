import DashboardCards from '../components/DashboardCards';
import DataTable from '../components/DataTable';
import MonthPicker from '../components/MonthPicker';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

// Current Onyx Houseware inventory status  
const mockTopItems = [
  { name: 'Tawa 280mm', pendingQty: 45, safetyStock: 20, status: 'Critical' },
  { name: 'Casserole 240mm', pendingQty: 32, safetyStock: 10, status: 'Critical' },
  { name: 'Kadai 240mm', pendingQty: 28, safetyStock: 15, status: 'Low' },
  { name: 'Fry Pan 240mm', pendingQty: 18, safetyStock: 15, status: 'Good' },
  { name: 'Paniyaram 12 pits', pendingQty: 12, safetyStock: 8, status: 'Good' }
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