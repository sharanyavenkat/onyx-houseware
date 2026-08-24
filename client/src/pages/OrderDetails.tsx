import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Truck } from 'lucide-react';
import { useState, useMemo } from 'react';
import ShipmentTracking from '../components/ShipmentTracking';
import AccessoryShipmentTracking from '../components/AccessoryShipmentTracking';
import InvoiceSection from '../components/InvoiceSection';
import { formatDate } from '@/lib/dateUtils';
import type { Shipment, OrderAccessoryShipment } from '@shared/schema';

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [trackingShipment, setTrackingShipment] = useState<any>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingAccessoryItem, setTrackingAccessoryItem] = useState<any>(null);
  const [isAccessoryTrackingOpen, setIsAccessoryTrackingOpen] = useState(false);

  const orderId = parseInt(id || '0');

  const { data: order, isLoading } = useQuery<any>({
    queryKey: ['/api/orders', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error('Failed to fetch order');
      return response.json();
    },
  });

  // Fetch all shipments for this order
  const { data: shipments = [] } = useQuery<Shipment[]>({
    queryKey: ['/api/shipments', 'order', orderId],
    enabled: !!orderId,
  });

  const { data: accessoryShipments = [] } = useQuery<OrderAccessoryShipment[]>({
    queryKey: ['/api/order-accessory-shipments/by-order', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/order-accessory-shipments/by-order/${orderId}`);
      if (!response.ok) throw new Error('Failed to fetch accessory shipments');
      return response.json();
    },
    enabled: !!orderId,
  });

  // Calculate shipment summary per order item
  // Note: Rejections are now tracked at batch level (caster QC), not at shipment level
  const shipmentSummary = useMemo(() => {
    const summary: Record<number, { shipped: number; remaining: number }> = {};
    
    if (!order?.line_items || !shipments) return summary;
    
    order.line_items.forEach((item: any) => {
      const orderItemId = item.order_item_id;
      const orderedQty = item.quantity;
      
      // Find all shipments for this order item
      const itemShipments = shipments.filter((s: any) => s.order_item_id === orderItemId);
      
      // Calculate totals - simple: ordered minus shipped
      const shipped = itemShipments.reduce((sum: number, s: any) => sum + s.quantity_shipped, 0);
      const remaining = orderedQty - shipped;
      
      summary[orderItemId] = { shipped, remaining };
    });
    
    return summary;
  }, [order, shipments]);

  const accessoryShipmentSummary = useMemo(() => {
    const summary: Record<number, { shipped: number; remaining: number }> = {};
    if (!order?.accessory_items) return summary;
    order.accessory_items.forEach((ai: any) => {
      const shipped = accessoryShipments
        .filter((s) => s.order_accessory_item_id === ai.order_accessory_item_id)
        .reduce((sum, s) => sum + s.quantity_shipped, 0);
      summary[ai.order_accessory_item_id] = { shipped, remaining: ai.quantity - shipped };
    });
    return summary;
  }, [order, accessoryShipments]);

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
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/orders')}
          data-testid="button-back-to-orders"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg sm:text-2xl font-bold truncate">Order: {order.po_number}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Customer:</span>
              <p className="font-medium">{order.customer_name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Status:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant={statusVariants[order.status] || 'secondary'}>
                  {order.status}
                </Badge>
                <Badge variant="outline">
                  {({ oem: 'OEM', d2c: 'D2C' } as Record<string, string>)[order.channel] || order.channel || 'OEM'}
                </Badge>
                {order.order_type === 'sample' && (
                  <Badge variant="outline" className="border-cyan-500 text-cyan-600">
                    {order.is_free_sample ? 'Free Sample' : 'Sample'}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Order Date:</span>
              <p className="font-medium">{formatDate(order.order_date)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Fulfillment:</span>
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
            <div>
              <span className="text-sm text-muted-foreground">Total Shipped:</span>
              <p className="font-medium">
                {shipments.reduce((sum: number, s: Shipment) => sum + s.quantity_shipped, 0)}
              </p>
            </div>
          </div>
          {order.notes && (
            <div className="mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">Notes:</span>
              <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {order.component_summary && (order.component_summary.items?.length > 0 || order.component_summary.accessories?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>What This Order Actually Represents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Kit lines decomposed through their BOM, combined with direct item and accessory lines — this is the real per-SKU demand this order creates.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {order.component_summary.items.map((item: any) => (
                <div key={`item-${item.itemId}`} className="border rounded-md px-3 py-2">
                  <div className="text-sm font-medium">{item.itemName}</div>
                  <div className="font-mono text-lg">{item.quantity}</div>
                </div>
              ))}
              {order.component_summary.accessories.map((acc: any) => (
                <div key={`acc-${acc.accessoryId}`} className="border rounded-md px-3 py-2 bg-muted/30">
                  <div className="text-sm font-medium">{acc.accessoryName}</div>
                  <div className="font-mono text-lg">{acc.quantity}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div className="flex-1">
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                        {item.variant_note && (
                          <div className="text-sm text-muted-foreground italic">Variant: {item.variant_note}</div>
                        )}
                        
                        {hasShipments && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
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
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Remaining:</span>
                              <span className={`font-mono font-semibold ${summary.remaining === 0 ? 'text-muted-foreground' : 'text-orange-600 dark:text-orange-400'}`}>
                                {summary.remaining}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4">
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
                          className="whitespace-nowrap"
                        >
                          <Truck className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Track Shipments</span>
                          <span className="sm:hidden">Track</span>
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

      {order.accessory_items && order.accessory_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Accessories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md divide-y">
              {order.accessory_items.map((accItem: any, index: number) => {
                const summary = accessoryShipmentSummary[accItem.order_accessory_item_id];
                const hasShipments = summary && summary.shipped > 0;
                return (
                  <div
                    key={index}
                    className="px-4 py-3"
                    data-testid={`order-detail-accessory-${index}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div className="flex-1">
                        <div className="font-medium">{accItem.accessory_name}</div>
                        {hasShipments && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Ordered:</span>
                              <span className="font-mono font-semibold">{accItem.quantity}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Shipped:</span>
                              <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                                {summary.shipped}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Remaining:</span>
                              <span className={`font-mono font-semibold ${summary.remaining === 0 ? 'text-muted-foreground' : 'text-orange-600 dark:text-orange-400'}`}>
                                {summary.remaining}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {!hasShipments && (
                          <div className="text-right">
                            <div className="font-semibold">{accItem.quantity} pcs</div>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTrackingAccessoryItem(accItem);
                            setIsAccessoryTrackingOpen(true);
                          }}
                          data-testid={`button-track-accessory-shipment-${index}`}
                          className="whitespace-nowrap"
                        >
                          <Truck className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Track Shipments</span>
                          <span className="sm:hidden">Track</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {shipments.length > 0 && (
        <InvoiceSection 
          orderId={orderId} 
          shipments={shipments} 
          items={order.line_items || []}
        />
      )}

      {trackingShipment && (
        <ShipmentTracking
          isOpen={isTrackingOpen}
          onClose={() => {
            setIsTrackingOpen(false);
            setTrackingShipment(null);
          }}
          orderItemId={trackingShipment.order_item_id}
          orderId={order.id}
          itemId={trackingShipment.item_id}
          itemName={trackingShipment.item_name}
          orderedQuantity={trackingShipment.quantity}
          isKit={trackingShipment.is_kit}
        />
      )}

      {trackingAccessoryItem && (
        <AccessoryShipmentTracking
          isOpen={isAccessoryTrackingOpen}
          onClose={() => {
            setIsAccessoryTrackingOpen(false);
            setTrackingAccessoryItem(null);
          }}
          orderAccessoryItemId={trackingAccessoryItem.order_accessory_item_id}
          orderId={order.id}
          accessoryId={trackingAccessoryItem.accessory_id}
          accessoryName={trackingAccessoryItem.accessory_name}
          orderedQuantity={trackingAccessoryItem.quantity}
        />
      )}
    </div>
  );
}
