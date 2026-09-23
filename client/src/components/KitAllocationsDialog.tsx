import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Batch } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

interface KitAllocation {
  id: number;
  shipment_id: number;
  component_type: "item" | "accessory";
  component_item_id: number | null;
  component_accessory_id: number | null;
  batch_id: number | null;
  quantity: number;
  itemName?: string;
  accessoryName?: string;
  batchNumber?: string;
  batchColor?: string | null;
}

interface KitAllocationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: number;
  itemName: string;
}

// A per-row batch picker — fetches active batches for THIS row's component
// item (not the kit item, which has no batches of its own), and includes
// the row's currently-assigned batch even if it has since become depleted,
// so the current (possibly wrong-color) selection is always visible.
function BatchPicker({
  componentItemId,
  currentBatchId,
  currentBatchNumber,
  onChange,
  disabled,
}: {
  componentItemId: number;
  currentBatchId: number | null;
  currentBatchNumber?: string;
  onChange: (batchId: number) => void;
  disabled?: boolean;
}) {
  const { data: activeBatches = [] } = useQuery<Batch[]>({
    queryKey: ["/api/batches/active/by-item", componentItemId],
    queryFn: async () => {
      const response = await fetch(`/api/batches/active/by-item/${componentItemId}`);
      if (!response.ok) throw new Error("Failed to fetch batches");
      return response.json();
    },
  });

  const { data: currentBatch } = useQuery<Batch>({
    queryKey: ["/api/batches/by-number", currentBatchNumber],
    queryFn: async () => {
      const response = await fetch(`/api/batches/by-number/${currentBatchNumber}`);
      if (!response.ok) throw new Error("Failed to fetch batch");
      return response.json();
    },
    enabled: !!currentBatchNumber,
  });

  const options = [...activeBatches];
  if (currentBatch && !options.some(b => b.id === currentBatch.id)) {
    options.unshift(currentBatch);
  }

  return (
    <Select
      value={currentBatchId ? String(currentBatchId) : undefined}
      onValueChange={(val) => onChange(parseInt(val))}
      disabled={disabled}
    >
      <SelectTrigger data-testid="select-allocation-batch">
        <SelectValue placeholder="Select batch" />
      </SelectTrigger>
      <SelectContent>
        {options.map((batch) => (
          <SelectItem key={batch.id} value={String(batch.id)}>
            <div className="flex flex-col">
              <span>{batch.batch_number} ({batch.quantity_remaining.toLocaleString()} remaining)</span>
              {batch.color && (
                <span className="text-xs text-muted-foreground">{batch.color}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function KitAllocationsDialog({
  isOpen,
  onClose,
  shipmentId,
  itemName,
}: KitAllocationsDialogProps) {
  const { toast } = useToast();
  const { canMutate } = useAuth();
  const [pendingQuantities, setPendingQuantities] = useState<Record<number, string>>({});

  const { data: allocations = [] } = useQuery<KitAllocation[]>({
    queryKey: ["/api/shipments", shipmentId, "kit-allocations"],
    queryFn: async () => {
      const response = await fetch(`/api/shipments/${shipmentId}/kit-allocations`);
      if (!response.ok) throw new Error("Failed to fetch batch allocations");
      return response.json();
    },
    enabled: isOpen,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId, "kit-allocations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
    queryClient.invalidateQueries({ queryKey: ["/api/batches/active/by-item"] });
    queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
  };

  const reassignMutation = useMutation({
    mutationFn: async ({ allocationId, batchId, quantity }: { allocationId: number; batchId: number; quantity?: number }) => {
      return await apiRequest("PATCH", `/api/kit-shipment-allocations/${allocationId}`, {
        batch_id: batchId,
        ...(quantity !== undefined ? { quantity } : {}),
      });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Batch allocation updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't update allocation", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (allocationId: number) => {
      return await apiRequest("DELETE", `/api/kit-shipment-allocations/${allocationId}`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Allocation row removed, stock restored" });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't remove allocation", description: error.message, variant: "destructive" });
    },
  });

  const itemAllocations = allocations.filter(a => a.component_type === "item");
  const accessoryAllocations = allocations.filter(a => a.component_type === "accessory");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batches used — {itemName}</DialogTitle>
          <DialogDescription>
            Which batch(es) this kit shipment drew from. If the wrong color or batch was used,
            pick the correct one here — stock is restored on the old batch and deducted from the new one.
          </DialogDescription>
        </DialogHeader>

        {itemAllocations.length > 0 ? (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right w-24">Qty</TableHead>
                  {canMutate && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemAllocations.map((a) => (
                  <TableRow key={a.id} data-testid={`row-allocation-${a.id}`}>
                    <TableCell className="font-medium">
                      {a.itemName || `Item #${a.component_item_id}`}
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      {canMutate ? (
                        <BatchPicker
                          componentItemId={a.component_item_id!}
                          currentBatchId={a.batch_id}
                          currentBatchNumber={a.batchNumber}
                          onChange={(batchId) => {
                            if (batchId === a.batch_id) return;
                            reassignMutation.mutate({ allocationId: a.id, batchId });
                          }}
                          disabled={reassignMutation.isPending}
                        />
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-mono">{a.batchNumber}</span>
                          {a.batchColor && (
                            <span className="text-xs text-muted-foreground">{a.batchColor}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canMutate ? (
                        <Input
                          type="number"
                          min={1}
                          className="w-20 text-right ml-auto"
                          value={pendingQuantities[a.id] ?? String(a.quantity)}
                          onChange={(e) => setPendingQuantities(prev => ({ ...prev, [a.id]: e.target.value }))}
                          onBlur={() => {
                            const raw = pendingQuantities[a.id];
                            if (raw === undefined) return;
                            const parsed = parseInt(raw, 10);
                            if (!isNaN(parsed) && parsed > 0 && parsed !== a.quantity && a.batch_id) {
                              reassignMutation.mutate({ allocationId: a.id, batchId: a.batch_id, quantity: parsed });
                            }
                          }}
                          data-testid={`input-allocation-quantity-${a.id}`}
                        />
                      ) : (
                        a.quantity
                      )}
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Remove this batch allocation and restore its stock?")) {
                              deleteMutation.mutate(a.id);
                            }
                          }}
                          data-testid={`button-delete-allocation-${a.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No batch-level allocations recorded for this shipment
          </div>
        )}

        {accessoryAllocations.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-muted-foreground mb-2">Accessories deducted</div>
            <div className="border rounded-md">
              <Table>
                <TableBody>
                  {accessoryAllocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.accessoryName || `Accessory #${a.component_accessory_id}`}</TableCell>
                      <TableCell className="text-right">{a.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
