import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDate } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OrderAccessoryShipment } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface AccessoryShipmentTrackingProps {
  isOpen: boolean;
  onClose: () => void;
  orderAccessoryItemId: number;
  orderId: number;
  accessoryId: number;
  accessoryName: string;
  orderedQuantity: number;
}

export default function AccessoryShipmentTracking({
  isOpen,
  onClose,
  orderAccessoryItemId,
  orderId,
  accessoryId,
  accessoryName,
  orderedQuantity,
}: AccessoryShipmentTrackingProps) {
  const { toast } = useToast();
  const { canMutate } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [quantityShipped, setQuantityShipped] = useState("");
  const [shipmentDate, setShipmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: allShipments = [] } = useQuery<OrderAccessoryShipment[]>({
    queryKey: ["/api/order-accessory-shipments/by-order", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/order-accessory-shipments/by-order/${orderId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch shipments");
      return res.json();
    },
    enabled: isOpen,
  });

  const shipments = allShipments.filter((s) => s.order_accessory_item_id === orderAccessoryItemId);
  const totalShipped = shipments.reduce((sum, s) => sum + s.quantity_shipped, 0);
  const remaining = orderedQuantity - totalShipped;

  const resetForm = () => {
    setQuantityShipped("");
    setShipmentDate(new Date().toISOString().split("T")[0]);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/order-accessory-shipments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/order-accessory-shipments/by-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/accessories"] });
      toast({ title: "Shipment recorded successfully" });
      resetForm();
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error recording shipment", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/order-accessory-shipments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/order-accessory-shipments/by-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/accessories"] });
      toast({ title: "Shipment deleted, stock restored" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting shipment", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantityShipped);
    if (!qty || qty <= 0 || !shipmentDate) {
      toast({ title: "Please fill quantity and date", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      order_id: orderId,
      order_accessory_item_id: orderAccessoryItemId,
      accessory_id: accessoryId,
      quantity_shipped: qty,
      shipment_date: shipmentDate,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Shipments — {accessoryName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>
              Ordered: <span className="font-mono font-semibold">{orderedQuantity}</span>
              {" · "}Shipped: <span className="font-mono font-semibold text-green-600 dark:text-green-400">{totalShipped}</span>
              {" · "}Remaining: <span className="font-mono font-semibold">{remaining}</span>
            </span>
            {canMutate && (
              <Button size="sm" variant="outline" onClick={() => setIsFormOpen(!isFormOpen)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Shipment
              </Button>
            )}
          </div>

          {isFormOpen && (
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 border rounded-md p-3">
              <div>
                <Label htmlFor="acc-qty">Quantity</Label>
                <Input
                  id="acc-qty"
                  type="number"
                  min="1"
                  value={quantityShipped}
                  onChange={(e) => setQuantityShipped(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="acc-date">Date</Label>
                <Input
                  id="acc-date"
                  type="date"
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          )}

          {shipments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Quantity</TableHead>
                  {canMutate && <TableHead className="w-9"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.shipment_date)}</TableCell>
                    <TableCell>{s.quantity_shipped}</TableCell>
                    {canMutate && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteId(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No shipments recorded yet.</p>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId !== null) {
            deleteMutation.mutate(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        title="Delete Shipment"
        description="Are you sure? This will restore the shipped quantity back to stock."
        confirmText="Delete"
      />
    </Dialog>
  );
}
