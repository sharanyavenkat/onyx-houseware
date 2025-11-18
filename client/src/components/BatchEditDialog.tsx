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
import type { Batch } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const batchEditSchema = z.object({
  quality_status: z.enum(["Good", "Acceptable", "Rejected"]),
  notes: z.string().optional(),
});

type BatchEditData = z.infer<typeof batchEditSchema>;

interface BatchEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onSave: (data: BatchEditData) => void;
  isPending: boolean;
}

export default function BatchEditDialog({
  isOpen,
  onOpenChange,
  batch,
  onSave,
  isPending,
}: BatchEditDialogProps) {
  const form = useForm<BatchEditData>({
    resolver: zodResolver(batchEditSchema),
    defaultValues: {
      quality_status: "Good",
      notes: "",
    },
  });

  // Reset form when batch changes
  useEffect(() => {
    if (batch) {
      form.reset({
        quality_status: batch.quality_status as "Good" | "Acceptable" | "Rejected",
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Batch Metadata</DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-3 bg-muted rounded-md space-y-1">
          <p className="text-sm">
            <span className="font-medium">Batch:</span> {batch.batch_number}
          </p>
          <p className="text-sm text-muted-foreground">
            Note: Quantity fields are computed by the system and cannot be edited manually.
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      rows={4}
                      data-testid="textarea-edit-notes"
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
