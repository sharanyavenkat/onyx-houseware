import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';

// TODO: Remove mock data functionality
const mockOrders = [
  { id: 1, po_number: 'ORD-2025-001', customer_name: 'ABC Manufacturing', status: 'draft', order_date: '2025-01-15', total_items: 3 },
  { id: 2, po_number: 'ORD-2025-002', customer_name: 'XYZ Industries', status: 'confirmed', order_date: '2025-01-14', total_items: 2 },
  { id: 3, po_number: 'ORD-2025-003', customer_name: 'Metal Works Inc', status: 'fulfilled', order_date: '2025-01-13', total_items: 5 },
  { id: 4, po_number: 'ORD-2025-004', customer_name: 'ABC Manufacturing', status: 'cancelled', order_date: '2025-01-12', total_items: 1 }
];

const mockCustomers = [
  { value: '1', label: 'ABC Manufacturing' },
  { value: '2', label: 'XYZ Industries' },
  { value: '3', label: 'Metal Works Inc' }
];

const orderFields = [
  { name: 'po_number', label: 'PO Number', type: 'text' as const, required: true, placeholder: 'Enter unique PO number' },
  { name: 'customer_id', label: 'Customer', type: 'select' as const, required: true, options: mockCustomers },
  { name: 'order_date', label: 'Order Date', type: 'text' as const, placeholder: 'YYYY-MM-DD' },
  { name: 'status', label: 'Status', type: 'select' as const, required: true, options: [
    { value: 'draft', label: 'Draft' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'fulfilled', label: 'Fulfilled' },
    { value: 'cancelled', label: 'Cancelled' }
  ]},
  { name: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Additional notes...' }
];

const orderColumns = [
  { key: 'po_number', label: 'PO Number' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'order_date', label: 'Order Date' },
  { key: 'total_items', label: 'Items' },
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
  const [location] = useLocation();
  const [orders, setOrders] = useState(mockOrders);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {} });

  // Parse URL search params to check for filter
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const filter = searchParams.get('filter');

  // Filter orders based on URL parameter
  const filteredOrders = useMemo(() => {
    if (filter === 'pending') {
      // Pending orders are those with status 'draft' or 'confirmed'
      return orders.filter(order => order.status === 'draft' || order.status === 'confirmed');
    }
    return orders;
  }, [orders, filter]);

  const handleAdd = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleView = (order: any) => {
    console.log('View order:', order);
    setViewingOrder(order);
  };

  const handleDelete = (order: any) => {
    let description = `Are you sure you want to delete order "${order.po_number}"? This action cannot be undone.`;
    
    if (order.status === 'confirmed') {
      description = `Order "${order.po_number}" is confirmed. Deleting it may affect customer expectations. Are you sure you want to proceed?`;
    }
    
    setConfirmationDialog({
      isOpen: true,
      title: 'Delete Order',
      description,
      onConfirm: () => {
        console.log('Delete order:', order);
        setOrders(orders.filter(o => o.id !== order.id));
      }
    });
  };

  const handleSubmit = (data: any) => {
    if (editingOrder) {
      // Edit existing order
      setOrders(orders.map(order => 
        order.id === editingOrder.id ? { ...order, ...data } : order
      ));
    } else {
      // Add new order
      const newOrder = {
        id: Math.max(...orders.map(o => o.id)) + 1,
        ...data,
        customer_name: mockCustomers.find(c => c.value === data.customer_id)?.label || 'Unknown',
        total_items: 0
      };
      setOrders([...orders, newOrder]);
    }
    setIsModalOpen(false);
    setEditingOrder(null);
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

  return (
    <div className="space-y-6" data-testid="page-orders">
      <DataTable 
        columns={enhancedColumns}
        data={filteredOrders}
        title={filter === 'pending' ? 'Pending Orders' : 'Orders'}
        addButtonLabel="Add Order"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      
      <FormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
        }}
        onSubmit={handleSubmit}
        title={editingOrder ? 'Edit Order' : 'Add New Order'}
        fields={orderFields}
        initialData={editingOrder || {}}
        submitLabel={editingOrder ? 'Update Order' : 'Add Order'}
      />
      
      {viewingOrder && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Order Details: {viewingOrder.po_number}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div><strong>Customer:</strong> {viewingOrder.customer_name}</div>
              <div><strong>Status:</strong> <Badge>{viewingOrder.status}</Badge></div>
              <div><strong>Order Date:</strong> {viewingOrder.order_date}</div>
              <div><strong>Total Items:</strong> {viewingOrder.total_items}</div>
            </div>
            <Button 
              variant="outline" 
              className="mt-4" 
              onClick={() => setViewingOrder(null)}
              data-testid="button-close-details"
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}
      
      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        onClose={() => setConfirmationDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmationDialog.onConfirm}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
        confirmLabel="Delete Order"
        isDestructive={true}
      />
    </div>
  );
}