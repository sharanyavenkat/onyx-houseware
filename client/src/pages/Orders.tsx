import DataTable from '../components/DataTable';
import OrderFormModal from '../components/OrderFormModal';
import ShipmentTracking from '../components/ShipmentTracking';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Package } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Order, Item, Customer } from '@shared/schema';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [trackingShipment, setTrackingShipment] = useState<any>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
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

  // Parse URL search params to check for filter
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setFilter(searchParams.get('filter'));
  }, [location]);

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

  // Filter orders based on URL parameter
  const filteredOrders = useMemo(() => {
    if (filter === 'pending') {
      return ordersWithCustomerNames.filter(order => order.status === 'draft' || order.status === 'confirmed');
    }
    return ordersWithCustomerNames;
  }, [ordersWithCustomerNames, filter]);

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
    setViewingOrder(order);
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
        customers={customerOptions}
        items={items}
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
              <div><strong>Fulfillment Date:</strong> {viewingOrder.fulfillment_date || 'Not set'}</div>
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
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">{item.quantity} pcs</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTrackingShipment(item);
                            setIsTrackingOpen(true);
                          }}
                          data-testid={`button-track-shipment-${index}`}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Track Shipments
                        </Button>
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

      {trackingShipment && viewingOrder && (
        <ShipmentTracking
          isOpen={isTrackingOpen}
          onClose={() => {
            setIsTrackingOpen(false);
            setTrackingShipment(null);
          }}
          orderItemId={trackingShipment.order_item_id}
          orderId={viewingOrder.id}
          itemName={trackingShipment.item_name}
          orderedQuantity={trackingShipment.quantity}
        />
      )}
    </div>
  );
}