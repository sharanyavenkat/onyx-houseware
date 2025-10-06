import DataTable from '../components/DataTable';
import OrderFormModal from '../components/OrderFormModal';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';

// TODO: Remove mock data functionality
export const mockOrders = [
  { 
    id: 1, 
    po_number: 'ORD-2025-001', 
    customer_name: 'ABC Manufacturing', 
    status: 'draft', 
    order_date: '2025-01-15', 
    line_items: [
      { item_id: 1, item_name: 'Tawa', sku: 'TWA-280', quantity: 10 },
      { item_id: 3, item_name: 'Kadai', sku: 'KD-240', quantity: 5 },
      { item_id: 5, item_name: 'Casserole', sku: 'CS-240', quantity: 8 }
    ]
  },
  { 
    id: 2, 
    po_number: 'ORD-2025-002', 
    customer_name: 'XYZ Industries', 
    status: 'confirmed', 
    order_date: '2025-01-14', 
    line_items: [
      { item_id: 2, item_name: 'Fry Pan', sku: 'FP-240', quantity: 15 },
      { item_id: 6, item_name: 'Paniyaram', sku: 'PN-12', quantity: 10 }
    ]
  },
  { 
    id: 3, 
    po_number: 'ORD-2025-003', 
    customer_name: 'Metal Works Inc', 
    status: 'fulfilled', 
    order_date: '2025-01-13', 
    line_items: [
      { item_id: 1, item_name: 'Tawa', sku: 'TWA-280', quantity: 20 },
      { item_id: 2, item_name: 'Fry Pan', sku: 'FP-240', quantity: 15 },
      { item_id: 3, item_name: 'Kadai', sku: 'KD-240', quantity: 12 },
      { item_id: 4, item_name: 'Casserole', sku: 'CS-220', quantity: 8 },
      { item_id: 8, item_name: 'Appachety', sku: 'AP-01', quantity: 10 }
    ]
  },
  { 
    id: 4, 
    po_number: 'ORD-2025-004', 
    customer_name: 'ABC Manufacturing', 
    status: 'cancelled', 
    order_date: '2025-01-12', 
    line_items: [
      { item_id: 5, item_name: 'Casserole', sku: 'CS-240', quantity: 5 }
    ]
  }
];

const mockCustomers = [
  { value: '1', label: 'ABC Manufacturing' },
  { value: '2', label: 'XYZ Industries' },
  { value: '3', label: 'Metal Works Inc' }
];

const orderColumns = [
  { key: 'po_number', label: 'PO Number' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'order_date', label: 'Order Date' },
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
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setFilter(searchParams.get('filter'));
  }, [location]);

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
        order.id === editingOrder.id ? { 
          ...order, 
          ...data,
          customer_name: mockCustomers.find(c => c.value === data.customer_id)?.label || order.customer_name
        } : order
      ));
    } else {
      // Add new order
      const maxId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) : 0;
      const newOrder = {
        id: maxId + 1,
        ...data,
        customer_name: mockCustomers.find(c => c.value === data.customer_id)?.label || 'Unknown'
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
        customers={mockCustomers}
      />
      
      {viewingOrder && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Order Details: {viewingOrder.po_number}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><strong>Customer:</strong> {viewingOrder.customer_name}</div>
              <div><strong>Status:</strong> <Badge>{viewingOrder.status}</Badge></div>
              <div><strong>Order Date:</strong> {viewingOrder.order_date}</div>
              <div><strong>Total Items:</strong> {viewingOrder.line_items?.length || 0}</div>
            </div>

            {viewingOrder.line_items && viewingOrder.line_items.length > 0 && (
              <div className="border rounded-md">
                <div className="bg-muted px-4 py-2 font-semibold text-sm">Order Items</div>
                <div className="divide-y">
                  {viewingOrder.line_items.map((item: any, index: number) => (
                    <div 
                      key={index} 
                      className="px-4 py-3 flex justify-between items-center"
                      data-testid={`order-detail-item-${index}`}
                    >
                      <div>
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{item.quantity} pcs</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-muted px-4 py-2 font-semibold text-sm flex justify-between">
                  <span>Total Pieces:</span>
                  <span>{viewingOrder.line_items.reduce((sum: number, item: any) => sum + item.quantity, 0)}</span>
                </div>
              </div>
            )}

            {viewingOrder.notes && (
              <div className="mt-4">
                <strong>Notes:</strong>
                <p className="text-muted-foreground mt-1">{viewingOrder.notes}</p>
              </div>
            )}

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