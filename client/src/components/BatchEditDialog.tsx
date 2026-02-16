import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Batch, Caster } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Trash2 } from "lucide-react";

const batchEditSchema = z.object({
  batch_number: z.string().min(1, "Batch number is required"),
  caster_id: z.string().optional(),
  purchase_order_id: z.string().optional(),
  received_date: z.string().min(1, "Received date is required"),
  quantity_received: z.string().min(1, "Received quantity is required"),
  quantity_rejected: z.string().optional(),
  quantity_produced: z.string().min(1, "Final quantity is required"),
  quality_status: z.enum(["Good", "Acceptable", "Rejected"]),
  notes: z.string().optional(),
});

type BatchEditData = z.infer<typeof batchEditSchema>;

interface BatchEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onSave: (data: any) => void;
  onDelete?: () => void;
  isPending: boolean;
  isDeleting?: boolean;
}

export default function BatchEditDialog({
  isOpen,
  onOpenChange,
  batch,
  onSave,
  onDelete,
  isPending,
  isDeleting,
}: BatchEditDialogProps) {
  const isManualOverrideRef = useRef(false);

  const { data: casters = [] } = useQuery<Caster[]>({
    queryKey: ['/api/casters'],
  });

  const form = useForm<BatchEditData>({
    resolver: zodResolver(batchEditSchema),
    defaultValues: {
      batch_number: "",
      caster_id: "",
      purchase_order_id: "",
      received_date: "",
      quantity_received: "0",
      quantity_rejected: "0",
      quantity_produced: "0",
      quality_status: "Good",
      notes: "",
    },
  });

  const watchedCasterId = useWatch({ control: form.control, name: "caster_id" });

  type POWithItems = { id: number; po_number: string; order_date: string; line_items: { item_id: number; item_name: string; quantity_ordered: number; quantity_received: number }[] };

  const { data: casterPOs = [] } = useQuery<POWithItems[]>({
    queryKey: ['/api/purchase-orders/by-caster', watchedCasterId],
    queryFn: async () => {
      if (!watchedCasterId || watchedCasterId === "none") return [];
      const res = await fetch(`/api/purchase-orders/by-caster/${watchedCasterId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!watchedCasterId && watchedCasterId !== "none",
    staleTime: 0,
  });

  const matchingPOs = useMemo(() => {
    if (!batch) return casterPOs;
    return casterPOs.filter(po => po.line_items.some(li => li.item_id === batch.item_id));
  }, [casterPOs, batch]);

  const quantityReceived = useWatch({ control: form.control, name: "quantity_received" }) || "0";
  const quantityRejected = useWatch({ control: form.control, name: "quantity_rejected" }) || "0";

  const expectedFinalQty = Math.max(0, (parseInt(quantityReceived) || 0) - (parseInt(quantityRejected) || 0));

  useEffect(() => {
    if (batch) {
      isManualOverrideRef.current = batch.is_manual_quantity || false;
      form.reset({
        batch_number: batch.batch_number,
        caster_id: batch.caster_id ? batch.caster_id.toString() : "",
        purchase_order_id: batch.purchase_order_id ? batch.purchase_order_id.toString() : "",
        received_date: batch.received_date,
        quantity_received: batch.quantity_received?.toString() || "0",
        quantity_rejected: batch.quantity_rejected?.toString() || "0",
        quantity_produced: batch.quantity_produced.toString(),
        quality_status: batch.quality_status as "Good" | "Acceptable" | "Rejected",
        notes: batch.notes || "",
      });
    }
  }, [batch, form]);

  useEffect(() => {
    if (!isManualOverrideRef.current) {
      form.setValue("quantity_produced", expectedFinalQty.toString());
    }
  }, [quantityReceived, quantityRejected, expectedFinalQty, form]);

  const handleRecalculate = () => {
    isManualOverrideRef.current = false;
    form.setValue("quantity_produced", expectedFinalQty.toString());
  };

  const handleSubmit = (data: BatchEditData) => {
    const payload = {
      batch_number: data.batch_number,
      caster_id: data.caster_id && data.caster_id !== "none" ? parseInt(data.caster_id) : null,
      purchase_order_id: data.purchase_order_id ? parseInt(data.purchase_order_id) : null,
      received_date: data.received_date,
      quantity_received: parseInt(data.quantity_received) || 0,
      quantity_rejected: parseInt(data.quantity_rejected || "0") || 0,
      quantity_produced: parseInt(data.quantity_produced) || 0,
      is_manual_quantity: isManualOverrideRef.current,
      quality_status: data.quality_status,
      notes: data.notes,
    };
    onSave(payload);
  };

  if (!batch) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="batch_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          data-testid="input-edit-batch-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="caster_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caster (Optional)</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-caster">
                            <SelectValue placeholder="Select caster" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No caster</SelectItem>
                          {casters.map((caster) => (
                            <SelectItem key={caster.id} value={caster.id.toString()}>
                              {caster.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(matchingPOs.length > 0 || batch?.purchase_order_id) && (
                  <FormField
                    control={form.control}
                    name="purchase_order_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Order</FormLabel>
                        <Select
                          value={field.value || "none"}
                          onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Link to purchase order" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {matchingPOs.map((po) => {
                              const poDate = new Date(po.order_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                              return (
                                <SelectItem key={po.id} value={po.id.toString()}>
                                  {po.po_number} - {poDate}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="received_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-edit-received-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="quantity_received"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qty Received</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              field.onChange(value);
                            }}
                            data-testid="input-edit-quantity-received"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity_rejected"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qty Rejected (QC)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              field.onChange(value);
                            }}
                            data-testid="input-edit-quantity-rejected"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="quantity_produced"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Final Quantity
                        {isManualOverrideRef.current && (
                          <Badge variant="secondary" className="text-xs">Manual Override</Badge>
                        )}
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              field.onChange(value);
                              if (parseInt(value) !== expectedFinalQty) {
                                isManualOverrideRef.current = true;
                              }
                            }}
                            data-testid="input-edit-quantity-produced"
                          />
                        </FormControl>
                        {isManualOverrideRef.current && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRecalculate}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expected: {expectedFinalQty.toLocaleString()} (Received - Rejected)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quality_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quality Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-quality-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Good">Good</SelectItem>
                          <SelectItem value="Acceptable">Acceptable</SelectItem>
                          <SelectItem value="Rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Additional notes about this batch..."
                          className="resize-none"
                          rows={3}
                          data-testid="textarea-edit-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

            <div className="flex justify-between items-center gap-3 pt-4">
              <div>
                {onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={onDelete}
                    disabled={isDeleting}
                    data-testid="button-delete-batch"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? "Deleting..." : "Delete Batch"}
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-save-edit"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
