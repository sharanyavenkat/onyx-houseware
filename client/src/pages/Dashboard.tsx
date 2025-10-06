import DashboardCards from '../components/DashboardCards';
import DataTable from '../components/DataTable';
import MonthPicker from '../components/MonthPicker';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

// Function to calculate status based on pending quantity vs safety stock
function calculateStatus(pendingQty: number, safetyStock: number): string {
  const ratio = pendingQty / safetyStock;
  if (ratio >= 2) return 'Critical';
  if (ratio >= 1.5) return 'Low';
  return 'Good';
}

// Current Onyx Houseware inventory status  
const mockTopItemsData = [
  { name: 'Tawa 280mm', pendingQty: 45, safetyStock: 20 },
  { name: 'Casserole 240mm', pendingQty: 32, safetyStock: 10 },
  { name: 'Kadai 240mm', pendingQty: 28, safetyStock: 15 },
  { name: 'Fry Pan 240mm', pendingQty: 18, safetyStock: 15 },
  { name: 'Paniyaram 12 pits', pendingQty: 12, safetyStock: 8 }
];

// Add calculated status to each item
const mockTopItems = mockTopItemsData.map(item => ({
  ...item,
  status: calculateStatus(item.pendingQty, item.safetyStock)
}));

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
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

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