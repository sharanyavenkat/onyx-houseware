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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Item, Caster, Die } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

const batchFormSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  caster_id: z.string().optional(),
  purchase_order_id: z.string().optional(),
  batch_number: z.string().min(1, "Batch number is required"),
  received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  quantity_received: z.string().min(1, "Received quantity is required"),
  quantity_rejected: z.string().optional(),
  quantity_produced: z.string().min(1, "Final quantity is required"),
  quality_status: z.enum(["Good", "Acceptable", "Rejected"]),
  color: z.string().optional(),
  notes: z.string().optional(),
});
// PO is deliberately optional even with a caster selected — most casters
// work off a running metal allocation (e.g. "sent 2.5 tons, whatever comes
// back after that date counts toward it"), not a discrete quantity-ordered
// PO. The reconciliation math already matches dispatches to batches by
// caster + running balance, not by a specific PO, so nothing else depends
// on this being set.

type BatchFormData = z.infer<typeof batchFormSchema>;

interface BatchFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
}

export default function BatchFormModal({
  isOpen,
  onOpenChange,
  items,
}: BatchFormModalProps) {
  const { toast } = useToast();
  const isManualOverrideRef = useRef(false);

  const { data: allCasters = [] } = useQuery<Caster[]>({
    queryKey: ['/api/casters'],
  });
  // Batches are specifically castings received — only actual casting
  // vendors belong here, not handle vendors/coaters/material suppliers.
  // Batches represent castings from a caster OR coated output from a coater
  // (whether via a Coating Conversion or a manual backfill entry) — no
  // longer just castings, since coated batches can be recorded directly here too.
  const casters = useMemo(() => allCasters.filter((c) => c.vendor_type === 'caster' || c.vendor_type === 'coater'), [allCasters]);

  const form = useForm<BatchFormData>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      item_id: "",
      caster_id: "",
      purchase_order_id: "",
      batch_number: "",
      received_date: new Date().toISOString().split("T")[0],
      quantity_received: "",
      quantity_rejected: "0",
      quantity_produced: "",
      quality_status: "Good",
      color: "",
      notes: "",
    },
  });

  const watchedCasterId = useWatch({ control: form.control, name: "caster_id" });
  const watchedItemId = useWatch({ control: form.control, name: "item_id" });

  // Defaults to showing only SKUs this caster has an active casting die for —
  // falls back to all items if die records are incomplete for this caster.
  const [showAllItems, setShowAllItems] = useState(false);
  const { data: dies = [] } = useQuery<Die[]>({
    queryKey: ['/api/dies'],
  });

  const casterHasDies = !!watchedCasterId && watchedCasterId !== "none" && dies.some(
    d => d.caster_id === parseInt(watchedCasterId) && d.mould_type === 'casting' && d.status === 'active'
  );

  const availableItems = useMemo(() => {
    const active = items.filter((item) => item.is_active && !item.is_kit);
    if (showAllItems || !watchedCasterId || watchedCasterId === "none") {
      return active;
    }
    const casterDieItemIds = new Set(
      dies
        .filter(d => d.caster_id === parseInt(watchedCasterId) && d.mould_type === 'casting' && d.status === 'active')
        .map(d => d.item_id)
    );
    if (casterDieItemIds.size === 0) {
      return active;
    }
    return active.filter(i => casterDieItemIds.has(i.id));
  }, [items, dies, watchedCasterId, showAllItems]);
  
  type POWithItems = { id: number; po_number: string; order_date: string; expected_delivery_date: string | null; status: string; line_items: { item_id: number; item_name: string; quantity_ordered: number; quantity_received: number }[] };
  
  const { data: casterPOs = [] } = useQuery<POWithItems[]>({
    queryKey: ['/api/purchase-orders/by-caster', watchedCasterId],
    queryFn: async () => {
      if (!watchedCasterId) return [];
      const res = await fetch(`/api/purchase-orders/by-caster/${watchedCasterId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!watchedCasterId,
    staleTime: 0,
  });

  const matchingPOs = useMemo(() => {
    const confirmed = casterPOs.filter(po => po.status === 'confirmed');
    if (!watchedItemId) return confirmed;
    const itemId = parseInt(watchedItemId);
    return confirmed.filter(po => po.line_items.some(li => li.item_id === itemId));
  }, [casterPOs, watchedItemId]);

  const quantityReceived = useWatch({ control: form.control, name: "quantity_received" }) || "";
  const quantityRejected = useWatch({ control: form.control, name: "quantity_rejected" }) || "";

  const expectedFinalQty = Math.max(0, (parseInt(quantityReceived) || 0) - (parseInt(quantityRejected) || 0));

  useEffect(() => {
    if (!isManualOverrideRef.current) {
      form.setValue("quantity_produced", expectedFinalQty.toString());
    }
  }, [quantityReceived, quantityRejected, expectedFinalQty, form]);

  useEffect(() => {
    if (!isOpen) {
      isManualOverrideRef.current = false;
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        item_id: parseInt(data.item_id),
        caster_id: data.caster_id ? parseInt(data.caster_id) : null,
        purchase_order_id: data.purchase_order_id ? parseInt(data.purchase_order_id) : null,
        quantity_received: parseInt(data.quantity_received) || 0,
        quantity_rejected: parseInt(data.quantity_rejected) || 0,
        quantity_produced: parseInt(data.quantity_produced) || 0,
      };
      return await apiRequest("POST", "/api/batches", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/monthly-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/casters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Batch created successfully" });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating batch",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: BatchFormData) => {
    createMutation.mutate(data);
  };

  const handleItemOrDateChange = () => {
    const itemId = form.watch("item_id");
    const receivedDate = form.watch("received_date");

    if (itemId && receivedDate) {
      const item = items.find((i) => i.id === parseInt(itemId));
      if (item) {
        const sku = item.sku.replace(/-/g, "");
        const date = new Date(receivedDate);
        const yy = date.getFullYear().toString().slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const batchNumber = `${sku}${yy}${mm}${dd}`;
        form.setValue("batch_number", batchNumber);
      }
    }
  };

  const handleRecalculate = () => {
    isManualOverrideRef.current = false;
    form.setValue("quantity_produced", expectedFinalQty.toString());
  };

  const quantityProduced = useWatch({ control: form.control, name: "quantity_produced" }) || "";
  const isManualOverride = isManualOverrideRef.current && quantityProduced !== "" && parseInt(quantityProduced) !== expectedFinalQty;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Batch</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="caster_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caster / Coater (Optional)</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) => {
                      field.onChange(value === "none" ? "" : value);
                      form.setValue("purchase_order_id", "");
                    }}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-batch-caster">
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

            <FormField
              control={form.control}
              name="item_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleItemOrDateChange();
                    }}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-batch-item">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableItems.map((item) => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          {item.name} ({item.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {watchedCasterId && watchedCasterId !== "none" && (
                    <p className="text-xs text-muted-foreground">
                      {showAllItems ? (
                        <>Showing all items. <button type="button" className="underline" onClick={() => setShowAllItems(false)}>Show only this caster's dies</button></>
                      ) : casterHasDies ? (
                        <>Showing only SKUs this caster has an active die for. <button type="button" className="underline" onClick={() => setShowAllItems(true)}>Show all items</button></>
                      ) : (
                        <>No die records found for this caster yet, showing all items.</>
                      )}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Purchase Order field hidden — doesn't fit how metal actually works with
                casters (running allocation, not itemized quantity orders). Kept in
                code, unrendered, in case a real itemized-order vendor needs it later.
            {watchedCasterId && watchedCasterId !== "" && watchedCasterId !== "none" && (
              <FormField
                control={form.control}
                name="purchase_order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Order (Optional)</FormLabel>
                    {matchingPOs.length > 0 ? (
                      <Select
                        value={field.value || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select purchase order" />
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
                    ) : (
                      <p className="text-sm text-muted-foreground">No confirmed purchase orders for this caster — that's fine, leave this blank if there isn't one for this batch.</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            */}

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
                      onChange={(e) => {
                        field.onChange(e);
                        handleItemOrDateChange();
                      }}
                      data-testid="input-received-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="batch_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Auto-generated from SKU + Date"
                      data-testid="input-batch-number"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground">
                    Format: SKU+YYMMDD (e.g., FP240250113)
                  </p>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
                        placeholder="0"
                        data-testid="input-quantity-received"
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
                        placeholder="0"
                        data-testid="input-quantity-rejected"
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
                  <div className="flex items-center gap-2">
                    <FormLabel>Final Quantity (Available)</FormLabel>
                    {isManualOverride && (
                      <Badge variant="outline" className="text-xs">
                        Manual Override
                      </Badge>
                    )}
                  </div>
                  <FormControl>
                    <div className="flex gap-2">
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
                        placeholder="Auto-calculated"
                        data-testid="input-quantity-produced"
                      />
                      {isManualOverride && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={handleRecalculate}
                          data-testid="button-recalculate"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground">
                    Expected: {expectedFinalQty} (received - rejected)
                  </p>
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
                      <SelectTrigger data-testid="select-quality-status">
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color / Variant (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. Black, Ivory"
                      data-testid="input-batch-color"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional notes about this batch..."
                      className="resize-none"
                      rows={3}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "Creating..." : "Create Batch"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
