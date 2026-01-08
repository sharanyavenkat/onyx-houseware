import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate, toInputDate } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Batch, Shipment } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Edit, Package, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface ShipmentTrackingProps {
  isOpen: boolean;
  onClose: () => void;
  orderItemId: number;
  orderId: number;
  itemId: number;
  itemName: string;
  orderedQuantity: number;
}

export default function ShipmentTracking({
  isOpen,
  onClose,
  orderItemId,
  orderId,
  itemId,
  itemName,
  orderedQuantity,
}: ShipmentTrackingProps) {
  const { toast } = useToast();
  const { canMutate } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<number | null>(null);
  const [batchNumber, setBatchNumber] = useState("");
  const [quantityShipped, setQuantityShipped] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");

  const { data: shipments = [] } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments/order-item", orderItemId],
    queryFn: async () => {
      const response = await fetch(`/api/shipments/order-item/${orderItemId}`);
      if (!response.ok) throw new Error("Failed to fetch shipments");
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: availableBatches = [] } = useQuery<Batch[]>({
    queryKey: ["/api/batches/active/by-item", itemId],
    queryFn: async () => {
      const response = await fetch(`/api/batches/active/by-item/${itemId}`);
      if (!response.ok) throw new Error("Failed to fetch batches");
      return response.json();
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/shipments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/shipments/order-item", orderItemId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/orders", orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/shipments", "order", orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches/active/by-item"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches/on-hand-stock"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/orders/pending-by-item"],
      });
      toast({ title: "Shipment recorded successfully" });
      resetForm();
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error recording shipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/shipments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/shipments/order-item", orderItemId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/orders", orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/shipments", "order", orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches/active/by-item"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches/on-hand-stock"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/orders/pending-by-item"],
      });
      toast({ title: "Shipment updated successfully" });
      resetForm();
      setIsFormOpen(false);
      setEditingShipment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating shipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/shipments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/shipments/order-item", orderItemId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/orders", orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/shipments", "order", orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches/active/by-item"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/batches/on-hand-stock"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/orders/pending-by-item"],
      });
      toast({ title: "Shipment deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting shipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setBatchNumber("");
    setQuantityShipped("");
    setShipmentDate("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchNumber || !quantityShipped || !shipmentDate) {
      toast({
        title: "Please fill all required fields (Batch Number, Quantity, Date)",
        variant: "destructive",
      });
      return;
    }

    const data = {
      order_id: orderId,
      order_item_id: orderItemId,
      batch_number: batchNumber,
      quantity_shipped: parseInt(quantityShipped),
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
    setBatchNumber(shipment.batch_number || "");
    setQuantityShipped(shipment.quantity_shipped.toString());
    setShipmentDate(toInputDate(shipment.shipment_date));
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    setShipmentToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (shipmentToDelete !== null) {
      deleteMutation.mutate(shipmentToDelete);
      setIsConfirmOpen(false);
      setShipmentToDelete(null);
    }
  };

  const summary = useMemo(() => {
    const totalShipped = shipments.reduce(
      (sum, s) => sum + s.quantity_shipped,
      0
    );
    const remaining = orderedQuantity - totalShipped;

    return {
      totalShipped,
      remaining: Math.max(0, remaining),
    };
  }, [shipments, orderedQuantity]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <span className="truncate">Shipment Tracking: {itemName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Ordered
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <p
                  className="text-xl sm:text-2xl font-bold"
                  data-testid="text-ordered-quantity"
                >
                  {orderedQuantity}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Shipped
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <p
                  className="text-xl sm:text-2xl font-bold"
                  data-testid="text-total-shipped"
                >
                  {summary.totalShipped}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Remaining
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <p
                  className={`text-xl sm:text-2xl font-bold ${summary.remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}
                  data-testid="text-remaining-quantity"
                >
                  {summary.remaining}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Shipments</h3>
              {canMutate && (
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
                  {editingShipment ? "Cancel Edit" : "Add Shipment"}
                </Button>
              )}
            </div>

            {canMutate && isFormOpen && (
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="batch_number">
                          Batch Number <span className="text-destructive">*</span>
                        </Label>
                        <Select value={batchNumber} onValueChange={setBatchNumber}>
                          <SelectTrigger data-testid="select-batch-number">
                            <SelectValue placeholder="Select batch..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBatches.length === 0 ? (
                              <SelectItem value="no-batches" disabled>
                                No active batches available
                              </SelectItem>
                            ) : (
                              availableBatches.map((batch) => (
                                <SelectItem key={batch.id} value={batch.batch_number}>
                                  {batch.batch_number} ({batch.quantity_remaining.toLocaleString()} remaining)
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="quantity_shipped">
                          Quantity Shipped{" "}
                          <span className="text-destructive">*</span>
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
                          Shipment Date{" "}
                          <span className="text-destructive">*</span>
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
                        {editingShipment ? "Update" : "Save"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {shipments.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Shipped</TableHead>
                        {canMutate && <TableHead></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipments.map((shipment) => (
                        <TableRow
                          key={shipment.id}
                          data-testid={`row-shipment-${shipment.id}`}
                        >
                          <TableCell className="font-medium font-mono">
                            {shipment.batch_number || "-"}
                          </TableCell>
                          <TableCell>
                            {formatDate(shipment.shipment_date)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {shipment.quantity_shipped}
                          </TableCell>
                          {canMutate && (
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
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="sm:hidden space-y-3">
                  {shipments.map((shipment) => (
                    <Card key={shipment.id} data-testid={`card-shipment-${shipment.id}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono font-semibold">
                              {shipment.batch_number || "-"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(shipment.shipment_date)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {shipment.quantity_shipped}
                            </div>
                            <div className="text-xs text-muted-foreground">shipped</div>
                          </div>
                        </div>
                        {canMutate && (
                          <div className="flex gap-2 mt-3 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(shipment)}
                              data-testid={`button-edit-shipment-mobile-${shipment.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(shipment.id)}
                              className="text-destructive"
                              data-testid={`button-delete-shipment-mobile-${shipment.id}`}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No shipments recorded yet
              </div>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          onConfirm={confirmDelete}
          title="Delete Shipment"
          description="Are you sure you want to delete this shipment? This action cannot be undone."
          confirmText="Delete"
        />
      </DialogContent>
    </Dialog>
  );
}
