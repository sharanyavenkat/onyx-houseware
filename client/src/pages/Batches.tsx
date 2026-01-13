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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Batch, Item, Caster } from "@shared/schema";
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
  const { canMutate } = useAuth();

  // Fetch all batches
  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ["/api/batches"],
  });

  // Fetch all items for filtering
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  // Fetch all casters
  const { data: casters = [] } = useQuery<Caster[]>({
    queryKey: ["/api/casters"],
  });

  // Enrich batches with item and caster information
  const enrichedBatches = useMemo(() => {
    return batches.map((batch) => {
      const item = items.find((i) => i.id === batch.item_id);
      const caster = batch.caster_id ? casters.find((c) => c.id === batch.caster_id) : null;
      return {
        ...batch,
        item_name: item?.name || "Unknown Item",
        item_sku: item?.sku || "",
        caster_name: caster?.name || null,
      };
    });
  }, [batches, items, casters]);

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

  // Sort items: active first, then by name alphabetically
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // Active items (true) should come before inactive (false)
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1;
      }
      // Within same active status, sort by name
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  // Group batches by item
  const batchesByItem = useMemo(() => {
    const grouped = new Map<number, typeof filteredBatches>();
    
    filteredBatches.forEach((batch) => {
      if (!grouped.has(batch.item_id)) {
        grouped.set(batch.item_id, []);
      }
      grouped.get(batch.item_id)!.push(batch);
    });
    
    // Sort batches within each item by received_date (newest first)
    grouped.forEach((batches) => {
      batches.sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime());
    });
    
    return grouped;
  }, [filteredBatches]);

  // Update mutation for editing batch
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      // Always use metadata endpoint which handles all fields including quantity_produced
      // The rejection endpoint is now only used internally when only rejection changes
      return await apiRequest("PATCH", `/api/batches/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/batches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
      toast({ title: "Batch deleted successfully" });
      setIsEditDialogOpen(false);
      setEditingBatch(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting batch",
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

  const handleDeleteBatch = () => {
    if (editingBatch) {
      deleteMutation.mutate(editingBatch.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-semibold">Batch Registry</h1>
          {canMutate && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              data-testid="button-add-batch"
            >
              <span className="hidden sm:inline">Add Batch</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Item Filter */}
          <Select value={selectedItem} onValueChange={setSelectedItem}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-item-filter">
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
            <SelectTrigger className="w-full sm:w-40" data-testid="select-quality-filter">
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
            <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Available</SelectItem>
              <SelectItem value="depleted">Depleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Batches List - Grouped by Item */}
      {batchesByItem.size === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No batches found. Add a batch to get started.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {sortedItems.map((item) => {
            const itemBatches = batchesByItem.get(item.id);
            if (!itemBatches || itemBatches.length === 0) return null;

            // Calculate summary stats for this item
            const totalRemaining = itemBatches.reduce((sum, b) => sum + b.quantity_remaining, 0);
            const totalProduced = itemBatches.reduce((sum, b) => sum + b.quantity_produced, 0);
            const totalRejected = itemBatches.reduce((sum, b) => sum + b.quantity_rejected, 0);
            const activeBatches = itemBatches.filter(b => !b.is_depleted).length;
            
            return (
              <AccordionItem
                key={item.id}
                value={`item-${item.id}`}
                className="border rounded-lg px-4"
                data-testid={`accordion-item-${item.id}`}
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-4 gap-2">
                    {/* Left: Item Name & SKU */}
                    <div className="text-left">
                      <div className="font-semibold text-base">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        SKU: {item.sku} • {itemBatches.length} batch{itemBatches.length !== 1 ? 'es' : ''} ({activeBatches} active)
                      </div>
                    </div>

                    {/* Right: Summary Quantities */}
                    <div className="flex items-center gap-4 sm:gap-6 font-mono text-sm">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          Remaining
                        </div>
                        <div className="font-bold text-sm sm:text-base">
                          {totalRemaining.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center hidden sm:block">
                        <div className="text-xs text-muted-foreground mb-1">
                          Final Qty
                        </div>
                        <div className="text-sm">
                          {totalProduced.toLocaleString()}
                        </div>
                      </div>
                      {totalRejected > 0 && (
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">
                            Qty Rejected
                          </div>
                          <div className="text-destructive text-sm">
                            {totalRejected.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-4 pt-2">
                  {/* Batches Table for this Item */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground px-4 pb-2">
                      Batches for {item.name}:
                    </div>
                    
                    {/* Desktop Table */}
                    <div className="hidden md:block border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm min-w-[800px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left py-2 px-3 font-medium">Batch</th>
                            <th className="text-left py-2 px-3 font-medium">Caster</th>
                            <th className="text-left py-2 px-3 font-medium">Date</th>
                            <th className="text-right py-2 px-3 font-medium">Qty Received</th>
                            <th className="text-right py-2 px-3 font-medium">Qty Rejected</th>
                            <th className="text-right py-2 px-3 font-medium">Final Qty</th>
                            <th className="text-right py-2 px-3 font-medium">Remaining</th>
                            <th className="text-center py-2 px-3 font-medium">Quality</th>
                            <th className="text-center py-2 px-3 font-medium">Status</th>
                            {canMutate && (
                              <th className="text-center py-2 px-3 font-medium">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {itemBatches.map((batch) => {
                            const qualityVariants: Record<string, any> = {
                              Good: "default",
                              Acceptable: "secondary",
                              Rejected: "destructive",
                            };
                            
                            return (
                              <tr 
                                key={batch.id} 
                                className="border-t hover-elevate"
                                data-testid={`row-batch-${batch.id}`}
                              >
                                <td className="py-3 px-3 font-mono text-sm">
                                  {batch.batch_number}
                                </td>
                                <td className="py-3 px-3 text-sm text-muted-foreground">
                                  {batch.caster_name || "-"}
                                </td>
                                <td className="py-3 px-3">
                                  {formatDate(batch.received_date)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono">
                                  {batch.quantity_received.toLocaleString()}
                                </td>
                                <td className={`py-3 px-3 text-right font-mono ${batch.quantity_rejected > 0 ? 'text-destructive font-medium' : ''}`}>
                                  {batch.quantity_rejected.toLocaleString()}
                                </td>
                                <td className="py-3 px-3 text-right font-mono">
                                  {batch.quantity_produced.toLocaleString()}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-semibold">
                                  {batch.quantity_remaining.toLocaleString()}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <Badge
                                    variant={
                                      qualityVariants[batch.quality_status || "Good"] ||
                                      "default"
                                    }
                                  >
                                    {batch.quality_status || "Good"}
                                  </Badge>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <Badge
                                    variant={batch.is_depleted ? "secondary" : "default"}
                                  >
                                    {batch.is_depleted ? "Depleted" : "Available"}
                                  </Badge>
                                </td>
                                {canMutate && (
                                  <td className="py-3 px-3 text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(batch)}
                                      data-testid={`button-edit-batch-${batch.id}`}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                      {itemBatches.map((batch) => {
                        const qualityVariants: Record<string, any> = {
                          Good: "default",
                          Acceptable: "secondary",
                          Rejected: "destructive",
                        };
                        
                        return (
                          <div 
                            key={batch.id} 
                            className="border rounded-lg p-4"
                            data-testid={`card-batch-${batch.id}`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="font-mono font-semibold">{batch.batch_number}</div>
                                <div className="text-sm text-muted-foreground">
                                  {formatDate(batch.received_date)}
                                  {batch.caster_name && ` • ${batch.caster_name}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    qualityVariants[batch.quality_status || "Good"] ||
                                    "default"
                                  }
                                >
                                  {batch.quality_status || "Good"}
                                </Badge>
                                {canMutate && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(batch)}
                                    data-testid={`button-edit-batch-mobile-${batch.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                              <div>
                                <div className="text-muted-foreground text-xs">Qty Received</div>
                                <div className="font-mono">{batch.quantity_received.toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">Qty Rejected</div>
                                <div className={`font-mono ${batch.quantity_rejected > 0 ? 'text-destructive font-medium' : ''}`}>
                                  {batch.quantity_rejected.toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="text-muted-foreground text-xs">Final Qty</div>
                                <div className="font-mono">{batch.quantity_produced.toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">Remaining</div>
                                <div className="font-mono font-semibold">{batch.quantity_remaining.toLocaleString()}</div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <Badge
                                variant={batch.is_depleted ? "secondary" : "default"}
                              >
                                {batch.is_depleted ? "Depleted" : "Available"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Notes section if any batch has notes */}
                    {itemBatches.some(b => b.notes) && (
                      <div className="mt-4 px-4 space-y-2">
                        <h4 className="font-medium text-sm">Batch Notes:</h4>
                        {itemBatches.filter(b => b.notes).map(batch => (
                          <div key={batch.id} className="text-sm">
                            <span className="font-mono text-muted-foreground">{batch.batch_number}:</span>{' '}
                            <span>{batch.notes}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
        onDelete={handleDeleteBatch}
        isPending={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
