import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Package, AlertTriangle, Edit } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDate, toInputDate } from '@/lib/dateUtils';
import type { Shipment } from '@shared/schema';

interface ShipmentTrackingProps {
  isOpen: boolean;
  onClose: () => void;
  orderItemId: number;
  orderId: number;
  itemName: string;
  orderedQuantity: number;
}

export default function ShipmentTracking({
  isOpen,
  onClose,
  orderItemId,
  orderId,
  itemName,
  orderedQuantity
}: ShipmentTrackingProps) {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [lotNumber, setLotNumber] = useState('');
  const [quantityShipped, setQuantityShipped] = useState('');
  const [shipmentDate, setShipmentDate] = useState('');
  const [rejectionsBlowhole, setRejectionsBlowhole] = useState('');
  const [rejectionsHandles, setRejectionsHandles] = useState('');
  const [rejectionsOther, setRejectionsOther] = useState('');

  const { data: shipments = [] } = useQuery<Shipment[]>({
    queryKey: ['/api/shipments/order-item', orderItemId],
    queryFn: async () => {
      const response = await fetch(`/api/shipments/order-item/${orderItemId}`);
      if (!response.ok) throw new Error('Failed to fetch shipments');
      return response.json();
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/shipments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shipments/order-item', orderItemId] });
      toast({ title: 'Shipment recorded successfully' });
      resetForm();
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error recording shipment', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/shipments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shipments/order-item', orderItemId] });
      toast({ title: 'Shipment updated successfully' });
      resetForm();
      setIsFormOpen(false);
      setEditingShipment(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating shipment', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/shipments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shipments/order-item', orderItemId] });
      toast({ title: 'Shipment deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting shipment', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setLotNumber('');
    setQuantityShipped('');
    setShipmentDate('');
    setRejectionsBlowhole('');
    setRejectionsHandles('');
    setRejectionsOther('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quantityShipped || !shipmentDate) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    const data = {
      order_id: orderId,
      order_item_id: orderItemId,
      lot_number: lotNumber || null,
      quantity_shipped: parseInt(quantityShipped),
      rejections_blowholes: parseInt(rejectionsBlowhole) || 0,
      rejections_handles: parseInt(rejectionsHandles) || 0,
      rejections_other: parseInt(rejectionsOther) || 0,
      shipment_date: shipmentDate,
    };

    if (editingShipment) {
      updateMutation.mutate({ id: editingShipment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setLotNumber(shipment.lot_number || '');
    setQuantityShipped(shipment.quantity_shipped.toString());
    setShipmentDate(toInputDate(shipment.shipment_date));
    setRejectionsBlowhole(shipment.rejections_blowholes.toString());
    setRejectionsHandles(shipment.rejections_handles.toString());
    setRejectionsOther(shipment.rejections_other.toString());
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this shipment?')) {
      deleteMutation.mutate(id);
    }
  };

  const summary = useMemo(() => {
    const totalShipped = shipments.reduce((sum, s) => sum + s.quantity_shipped, 0);
    const totalRejections = shipments.reduce((sum, s) => 
      sum + s.rejections_blowholes + s.rejections_handles + s.rejections_other, 0
    );
    const totalAccepted = Math.max(0, Math.min(totalShipped - totalRejections, orderedQuantity));
    const remaining = orderedQuantity - totalAccepted;

    return {
      totalShipped,
      totalRejections,
      totalAccepted,
      remaining: Math.max(0, remaining)
    };
  }, [shipments, orderedQuantity]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Shipment Tracking: {itemName}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ordered</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-ordered-quantity">{orderedQuantity}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Shipped</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-total-shipped">{summary.totalShipped}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejections</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive" data-testid="text-total-rejections">{summary.totalRejections}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-remaining-quantity">{summary.remaining}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Shipments</h3>
            <Button
              onClick={() => {
                setEditingShipment(null);
                resetForm();
                setIsFormOpen(!isFormOpen);
              }}
              size="sm"
              data-testid="button-add-shipment"
            >
              <Plus className="h-4 w-4 mr-1" />
              {editingShipment ? 'Cancel Edit' : 'Add Shipment'}
            </Button>
          </div>

          {isFormOpen && (
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="lot_number">
                        Lot Number (Optional)
                      </Label>
                      <Input
                        id="lot_number"
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        placeholder="e.g., LOT-001"
                        data-testid="input-lot-number"
                      />
                    </div>

                    <div>
                      <Label htmlFor="quantity_shipped">
                        Quantity Shipped <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="quantity_shipped"
                        type="number"
                        min="1"
                        value={quantityShipped}
                        onChange={(e) => setQuantityShipped(e.target.value)}
                        placeholder="e.g., 300"
                        data-testid="input-quantity-shipped"
                      />
                    </div>

                    <div>
                      <Label htmlFor="shipment_date">
                        Shipment Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="shipment_date"
                        type="date"
                        value={shipmentDate}
                        onChange={(e) => setShipmentDate(e.target.value)}
                        data-testid="input-shipment-date"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Rejections (Optional)
                    </Label>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <Label htmlFor="rejections_blowholes" className="text-xs">Blowholes</Label>
                        <Input
                          id="rejections_blowholes"
                          type="number"
                          min="0"
                          value={rejectionsBlowhole}
                          onChange={(e) => setRejectionsBlowhole(e.target.value)}
                          placeholder="0"
                          data-testid="input-rejections-blowholes"
                        />
                      </div>

                      <div>
                        <Label htmlFor="rejections_handles" className="text-xs">Handles</Label>
                        <Input
                          id="rejections_handles"
                          type="number"
                          min="0"
                          value={rejectionsHandles}
                          onChange={(e) => setRejectionsHandles(e.target.value)}
                          placeholder="0"
                          data-testid="input-rejections-handles"
                        />
                      </div>

                      <div>
                        <Label htmlFor="rejections_other" className="text-xs">Other</Label>
                        <Input
                          id="rejections_other"
                          type="number"
                          min="0"
                          value={rejectionsOther}
                          onChange={(e) => setRejectionsOther(e.target.value)}
                          placeholder="0"
                          data-testid="input-rejections-other"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetForm();
                        setIsFormOpen(false);
                        setEditingShipment(null);
                      }}
                      data-testid="button-cancel-shipment"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-save-shipment">
                      {editingShipment ? 'Update Shipment' : 'Save Shipment'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {shipments.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Shipped</TableHead>
                    <TableHead className="text-right">Blowholes</TableHead>
                    <TableHead className="text-right">Handles</TableHead>
                    <TableHead className="text-right">Other</TableHead>
                    <TableHead className="text-right">Total Rejections</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((shipment) => {
                    const totalRej = shipment.rejections_blowholes + shipment.rejections_handles + shipment.rejections_other;
                    const accepted = shipment.quantity_shipped - totalRej;
                    
                    return (
                      <TableRow key={shipment.id} data-testid={`row-shipment-${shipment.id}`}>
                        <TableCell className="font-medium">{shipment.lot_number || '-'}</TableCell>
                        <TableCell>{formatDate(shipment.shipment_date)}</TableCell>
                        <TableCell className="text-right">{shipment.quantity_shipped}</TableCell>
                        <TableCell className="text-right">{shipment.rejections_blowholes}</TableCell>
                        <TableCell className="text-right">{shipment.rejections_handles}</TableCell>
                        <TableCell className="text-right">{shipment.rejections_other}</TableCell>
                        <TableCell className="text-right text-destructive font-semibold">{totalRej}</TableCell>
                        <TableCell className="text-right font-semibold">{accepted}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(shipment)}
                              data-testid={`button-edit-shipment-${shipment.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(shipment.id)}
                              data-testid={`button-delete-shipment-${shipment.id}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No shipments recorded yet. Click "Add Shipment" to track your deliveries.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-close-tracking">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
