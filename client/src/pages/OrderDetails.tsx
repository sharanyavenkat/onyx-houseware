import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package } from 'lucide-react';
import { useState, useMemo } from 'react';
import ShipmentTracking from '../components/ShipmentTracking';
import { formatDate } from '@/lib/dateUtils';

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [trackingShipment, setTrackingShipment] = useState<any>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);

  const { data: order, isLoading } = useQuery<any>({
    queryKey: ['/api/orders', id],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${id}`);
      if (!response.ok) throw new Error('Failed to fetch order');
      return response.json();
    },
  });

  // Fetch all shipments for this order
  const { data: shipments = [] } = useQuery<any[]>({
    queryKey: ['/api/shipments', 'order', id],
    enabled: !!id,
  });

  // Calculate shipment summary per order item
  const shipmentSummary = useMemo(() => {
    const summary: Record<number, { shipped: number; rejected: number; remaining: number }> = {};
    
    if (!order?.line_items || !shipments) return summary;
    
    order.line_items.forEach((item: any) => {
      const orderItemId = item.order_item_id;
      const orderedQty = item.quantity;
      
      // Find all shipments for this order item
      const itemShipments = shipments.filter((s: any) => s.order_item_id === orderItemId);
      
      // Calculate totals
      const shipped = itemShipments.reduce((sum: number, s: any) => sum + s.quantity_shipped, 0);
      const rejected = itemShipments.reduce((sum: number, s: any) => {
        return sum + (s.blowhole_rejects || 0) + (s.handle_rejects || 0) + (s.other_rejects || 0);
      }, 0);
      const remaining = orderedQty - shipped;
      
      summary[orderItemId] = { shipped, rejected, remaining };
    });
    
    return summary;
  }, [order, shipments]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!order) {
    return <div className="p-6">Order not found</div>;
  }

  const statusVariants: Record<string, any> = {
    draft: 'secondary',
    confirmed: 'default',
    fulfilled: 'default',
    cancelled: 'destructive'
  };

  return (
    <div className="space-y-6 p-6" data-testid="page-order-details">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/orders')}
          data-testid="button-back-to-orders"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Order Details: {order.po_number}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Customer:</span>
              <p className="font-medium">{order.customer_name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Status:</span>
              <div className="mt-1">
                <Badge variant={statusVariants[order.status] || 'secondary'}>
                  {order.status}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Order Date:</span>
              <p className="font-medium">{formatDate(order.order_date)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Fulfillment Date:</span>
              <p className="font-medium">{formatDate(order.fulfillment_date)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Items:</span>
              <p className="font-medium">{order.line_items?.length || 0}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Pieces:</span>
              <p className="font-medium">
                {order.line_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          {order.line_items && order.line_items.length > 0 ? (
            <div className="border rounded-md divide-y">
              {order.line_items.map((item: any, index: number) => {
                const orderItemId = item.order_item_id;
                const summary = shipmentSummary[orderItemId];
                const hasShipments = summary && summary.shipped > 0;
                
                return (
                  <div
                    key={index}
                    className="px-4 py-3"
                    data-testid={`order-detail-item-${index}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                        
                        {hasShipments && (
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Ordered:</span>
                              <span className="font-mono font-semibold">{item.quantity}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Shipped:</span>
                              <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                                {summary.shipped}
                              </span>
                            </div>
                            {summary.rejected > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Rejected:</span>
                                <span className="font-mono font-semibold text-destructive">
                                  {summary.rejected}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Remaining:</span>
                              <span className={`font-mono font-semibold ${summary.remaining === 0 ? 'text-muted-foreground' : 'text-orange-600 dark:text-orange-400'}`}>
                                {summary.remaining}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 ml-4">
                        {!hasShipments && (
                          <div className="text-right">
                            <div className="font-semibold">{item.quantity} pcs</div>
                          </div>
                        )}
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
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No items in this order</p>
          )}
        </CardContent>
      </Card>

      {trackingShipment && (
        <ShipmentTracking
          isOpen={isTrackingOpen}
          onClose={() => {
            setIsTrackingOpen(false);
            setTrackingShipment(null);
          }}
          orderItemId={trackingShipment.order_item_id}
          orderId={order.id}
          itemName={trackingShipment.item_name}
          orderedQuantity={trackingShipment.quantity}
        />
      )}
    </div>
  );
}
