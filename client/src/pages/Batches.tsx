import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Batch, Item } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import BatchFormModal from "../components/BatchFormModal";
import BatchEditDialog from "../components/BatchEditDialog";
import { Edit } from "lucide-react";

export default function Batches() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  // Fetch all batches
  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ["/api/batches"],
  });

  // Fetch all items for filtering
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  // Enrich batches with item information
  const enrichedBatches = useMemo(() => {
    return batches.map((batch) => {
      const item = items.find((i) => i.id === batch.item_id);
      return {
        ...batch,
        item_name: item?.name || "Unknown Item",
        item_sku: item?.sku || "",
      };
    });
  }, [batches, items]);

  // Apply filters
  const filteredBatches = useMemo(() => {
    return enrichedBatches.filter((batch) => {
      if (selectedItem !== "all" && batch.item_id !== parseInt(selectedItem)) {
        return false;
      }
      if (qualityFilter !== "all" && batch.quality_status !== qualityFilter) {
        return false;
      }
      if (statusFilter === "active" && batch.is_depleted) {
        return false;
      }
      if (statusFilter === "depleted" && !batch.is_depleted) {
        return false;
      }
      return true;
    });
  }, [enrichedBatches, selectedItem, qualityFilter, statusFilter]);

  // Update mutation for editing batch metadata
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/batches/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/opening-balance"] });
      toast({ title: "Batch updated successfully" });
      setIsEditDialogOpen(false);
      setEditingBatch(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating batch",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (batch: any) => {
    setEditingBatch(batch);
    setIsEditDialogOpen(true);
  };

  const handleUpdateBatch = (data: any) => {
    if (editingBatch) {
      updateMutation.mutate({ id: editingBatch.id, data });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Batch Registry</h1>
        <div className="flex items-center gap-3">
          {/* Item Filter */}
          <Select value={selectedItem} onValueChange={setSelectedItem}>
            <SelectTrigger className="w-48" data-testid="select-item-filter">
              <SelectValue placeholder="All Items" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id.toString()}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Quality Filter */}
          <Select value={qualityFilter} onValueChange={setQualityFilter}>
            <SelectTrigger className="w-40" data-testid="select-quality-filter">
              <SelectValue placeholder="All Quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quality</SelectItem>
              <SelectItem value="Good">Good</SelectItem>
              <SelectItem value="Acceptable">Acceptable</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="depleted">Depleted</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            data-testid="button-add-batch"
          >
            Add Batch
          </Button>
        </div>
      </div>

      {/* Batches List - Collapsible Rows */}
      {filteredBatches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No batches found. Add a batch to get started.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filteredBatches.map((batch) => {
            const qualityVariants: Record<string, any> = {
              Good: "default",
              Acceptable: "secondary",
              Rejected: "destructive",
            };
            
            return (
              <AccordionItem
                key={batch.id}
                value={`batch-${batch.id}`}
                className="border rounded-lg px-4"
                data-testid={`accordion-batch-${batch.id}`}
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    {/* Left: Batch Number & Item */}
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <div className="font-semibold font-mono text-sm">
                          {batch.batch_number}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {batch.item_name}
                        </div>
                      </div>
                    </div>

                    {/* Center: Quantities */}
                    <div className="flex items-center gap-6 font-mono text-sm">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          Remaining
                        </div>
                        <div className="font-semibold">
                          {batch.quantity_remaining.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          Produced
                        </div>
                        <div>{batch.quantity_produced.toLocaleString()}</div>
                      </div>
                      {batch.quantity_rejected > 0 && (
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">
                            Rejected
                          </div>
                          <div className="text-destructive">
                            {batch.quantity_rejected.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Status Badges */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          qualityVariants[batch.quality_status || "Good"] ||
                          "default"
                        }
                      >
                        {batch.quality_status || "Good"}
                      </Badge>
                      <Badge
                        variant={batch.is_depleted ? "secondary" : "default"}
                      >
                        {batch.is_depleted ? "Depleted" : "Active"}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-4 pt-2">
                  <div className="grid grid-cols-2 gap-6 pl-4">
                    {/* Left Column: Batch Details */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Batch Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Received Date:
                          </span>
                          <span className="font-medium">
                            {formatDate(batch.received_date)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Quantity Produced:
                          </span>
                          <span className="font-mono">
                            {batch.quantity_produced.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Quantity Remaining:
                          </span>
                          <span className="font-mono font-semibold">
                            {batch.quantity_remaining.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Quantity Rejected:
                          </span>
                          <span
                            className={`font-mono ${
                              batch.quantity_rejected > 0
                                ? "text-destructive font-medium"
                                : ""
                            }`}
                          >
                            {batch.quantity_rejected.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Quality Status:
                          </span>
                          <Badge
                            variant={
                              qualityVariants[
                                batch.quality_status || "Good"
                              ] || "default"
                            }
                          >
                            {batch.quality_status || "Good"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Depletion Status:
                          </span>
                          <Badge
                            variant={
                              batch.is_depleted ? "secondary" : "default"
                            }
                          >
                            {batch.is_depleted ? "Depleted" : "Active"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Notes & Actions */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">
                          {batch.notes || "No notes"}
                        </p>
                      </div>

                      <div className="pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(batch);
                          }}
                          data-testid={`button-edit-batch-${batch.id}`}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Metadata
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Create Batch Modal */}
      <BatchFormModal
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        items={items}
      />

      {/* Edit Batch Dialog */}
      <BatchEditDialog
        isOpen={isEditDialogOpen}
        onOpenChange={(open: boolean) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingBatch(null);
        }}
        batch={editingBatch}
        onSave={handleUpdateBatch}
        isPending={updateMutation.isPending}
      />
    </div>
  );
}
