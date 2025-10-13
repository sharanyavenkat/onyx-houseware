import DataTable from '../components/DataTable';
import OrderFormModal from '../components/OrderFormModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/dateUtils';
import type { Order, Item, Customer } from '@shared/schema';

const orderColumns = [
  { key: 'po_number', label: 'PO Number' },
  { key: 'customer_name', label: 'Customer' },
  { 
    key: 'order_date', 
    label: 'Order Date',
    render: (value: string) => formatDate(value)
  },
  { 
    key: 'items_count', 
    label: 'Items', 
    render: (_: any, row: any) => row.line_items?.length || 0
  },
  { 
    key: 'total_pieces', 
    label: 'Total Pcs', 
    render: (_: any, row: any) => row.line_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0
  },
  { 
    key: 'status', 
    label: 'Status', 
    render: (value: string) => {
      const variants: Record<string, any> = {
        draft: 'secondary',
        confirmed: 'default',
        fulfilled: 'default',
        cancelled: 'destructive'
      };
      return <Badge variant={variants[value] || 'secondary'}>{value}</Badge>;
    }
  }
];

export default function Orders() {
  const [location, setLocation] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const { toast } = useToast();

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  // Map customer data for dropdown
  const customerOptions = useMemo(() => {
    return customers.map(c => ({
      value: c.id.toString(),
      label: c.company_name
    }));
  }, [customers]);

  // Map orders to include customer names
  const ordersWithCustomerNames = useMemo(() => {
    return orders.map(order => ({
      ...order,
      customer_name: customers.find(c => c.id === order.customer_id)?.company_name || 'Unknown'
    }));
  }, [orders, customers]);

  // Get unique months from orders
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach(order => {
      if (order.order_date) {
        const date = new Date(order.order_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  // Filter orders by selected month
  const filteredOrders = useMemo(() => {
    if (selectedMonth === 'all') {
      return ordersWithCustomerNames;
    }
    return ordersWithCustomerNames.filter(order => {
      if (!order.order_date) return false;
      const date = new Date(order.order_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === selectedMonth;
    });
  }, [ordersWithCustomerNames, selectedMonth]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/orders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Order created successfully' });
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating order', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Order updated successfully' });
      setIsModalOpen(false);
      setEditingOrder(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating order', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Order deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting order', description: error.message, variant: 'destructive' });
    },
  });

  const handleAdd = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleView = (order: any) => {
    setLocation(`/orders/${order.id}`);
  };

  const handleDelete = (order: any) => {
    if (confirm(`Are you sure you want to delete order "${order.po_number}"? This action cannot be undone.`)) {
      deleteMutation.mutate(order.id);
    }
  };

  const handleSubmit = (data: any) => {
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const enhancedColumns = [
    ...orderColumns,
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleView(row)}
          data-testid={`button-view-${row.id}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
      )
    }
  ];

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-6" data-testid="page-orders">
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium">Filter by Month:</label>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]" data-testid="select-month-filter">
            <SelectValue placeholder="All Months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {availableMonths.map(month => (
              <SelectItem key={month} value={month}>
                {formatMonthLabel(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable 
        columns={enhancedColumns}
        data={filteredOrders}
        title="Orders"
        addButtonLabel="Add Order"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      
      <OrderFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
        }}
        onSubmit={handleSubmit}
        title={editingOrder ? 'Edit Order' : 'Add New Order'}
        initialData={editingOrder || {}}
        submitLabel={editingOrder ? 'Update Order' : 'Add Order'}
        customers={customerOptions}
        items={items}
      />
    </div>
  );
}