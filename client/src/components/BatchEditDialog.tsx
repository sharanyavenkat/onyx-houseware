import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { Batch } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Trash2 } from "lucide-react";

const batchEditSchema = z.object({
  batch_number: z.string().min(1, "Batch number is required"),
  received_date: z.string().min(1, "Received date is required"),
  quantity_produced: z.preprocess(
    (val) => val === undefined || val === "" ? undefined : val,
    z.number().int().min(1, "Produced quantity must be at least 1")
  ),
  quality_status: z.enum(["Good", "Acceptable", "Rejected"]),
  quantity_rejected: z.preprocess(
    (val) => val === undefined || val === "" ? 0 : val,
    z.number().int().min(0, "Rejected quantity cannot be negative")
  ),
  notes: z.string().optional(),
});

type BatchEditData = z.infer<typeof batchEditSchema>;

interface BatchEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onSave: (data: BatchEditData) => void;
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
  const form = useForm<BatchEditData>({
    resolver: zodResolver(batchEditSchema),
    defaultValues: {
      batch_number: "",
      received_date: "",
      quantity_produced: 0,
      quality_status: "Good",
      quantity_rejected: 0,
      notes: "",
    },
  });

  // Reset form when batch changes
  useEffect(() => {
    if (batch) {
      form.reset({
        batch_number: batch.batch_number,
        received_date: batch.received_date,
        quantity_produced: batch.quantity_produced,
        quality_status: batch.quality_status as "Good" | "Acceptable" | "Rejected",
        quantity_rejected: batch.quantity_rejected,
        notes: batch.notes || "",
      });
    }
  }, [batch, form]);

  const handleSubmit = (data: BatchEditData) => {
    onSave(data);
  };

  if (!batch) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
          <DialogDescription>
            Update batch information and quality status
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6">
          {/* Left column - Current values */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">Current Values</h3>
            <div className="p-4 bg-muted rounded-md space-y-2">
              <p className="text-sm">
                <span className="font-medium">Batch Number:</span> {batch.batch_number}
              </p>
              <p className="text-sm">
                <span className="font-medium">Received Date:</span> {batch.received_date}
              </p>
              <p className="text-sm">
                <span className="font-medium">Produced:</span> {batch.quantity_produced.toLocaleString()}
              </p>
              <p className="text-sm">
                <span className="font-medium">Shipped:</span> {(batch.quantity_produced - batch.quantity_remaining - batch.quantity_rejected).toLocaleString()}
              </p>
              <p className="text-sm">
                <span className="font-medium">Rejected:</span> {batch.quantity_rejected.toLocaleString()}
              </p>
              <p className="text-sm">
                <span className="font-medium">Remaining:</span> {batch.quantity_remaining.toLocaleString()}
              </p>
              <p className="text-sm">
                <span className="font-medium">Quality:</span> {batch.quality_status}
              </p>
              <p className="text-sm text-muted-foreground text-xs mt-3">
                Formula: Remaining = Produced - Shipped - Rejected
              </p>
            </div>
          </div>

          {/* Right column - Edit form */}
          <div>
            <h3 className="font-medium text-sm text-muted-foreground mb-3">Edit Values</h3>
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

                <FormField
                  control={form.control}
                  name="quantity_produced"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity Produced</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            const newValue = value === "" ? undefined : parseInt(value);
                            field.onChange(newValue);
                          }}
                          data-testid="input-edit-quantity-produced"
                        />
                      </FormControl>
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
                  name="quantity_rejected"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rejected Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            const newValue = value === "" ? undefined : parseInt(value);
                            field.onChange(newValue);
                          }}
                          data-testid="input-edit-quantity-rejected"
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
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Additional notes about this batch..."
                          className="resize-none"
                          rows={4}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
