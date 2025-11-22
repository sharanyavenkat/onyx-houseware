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
import type { Item } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

const batchFormSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  batch_number: z.string().min(1, "Batch number is required"),
  received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  quantity_produced: z.string().min(1, "Quantity is required"),
  quality_status: z.enum(["Good", "Acceptable", "Rejected"]),
  notes: z.string().optional(),
});

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

  const form = useForm<BatchFormData>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      item_id: "",
      batch_number: "",
      received_date: new Date().toISOString().split("T")[0],
      quantity_produced: "",
      quality_status: "Good",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Convert string values to proper types
      const payload = {
        ...data,
        item_id: parseInt(data.item_id),
        quantity_produced: parseFloat(data.quantity_produced),
      };
      return await apiRequest("POST", "/api/batches", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/opening-balance"] });
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

  // Auto-format batch number when item or date changes
  const handleItemOrDateChange = () => {
    const itemId = form.watch("item_id");
    const receivedDate = form.watch("received_date");

    if (itemId && receivedDate) {
      const item = items.find((i) => i.id === parseInt(itemId));
      if (item) {
        // Format: SKU (without hyphens) + YYMMDD
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Batch</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 flex-1 overflow-y-auto pr-2">
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
                      {items
                        .filter((item) => item.is_active)
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.name} ({item.sku})
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

            <FormField
              control={form.control}
              name="quantity_produced"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Produced</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      {...field}
                      placeholder="Enter quantity produced"
                      data-testid="input-quantity-produced"
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
