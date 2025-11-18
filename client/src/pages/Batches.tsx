import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Batch, Item } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import BatchFormModal from "../components/BatchFormModal";
import BatchEditDialog from "../components/BatchEditDialog";

const batchColumns = [
  { key: "batch_number", label: "Batch Number" },
  { key: "item_name", label: "Item" },
  {
    key: "received_date",
    label: "Received Date",
    render: (value: string) => formatDate(value),
  },
  {
    key: "quantity_produced",
    label: "Produced",
    render: (value: number) => value.toLocaleString(),
  },
  {
    key: "quantity_remaining",
    label: "Remaining",
    render: (value: number) => value.toLocaleString(),
  },
  {
    key: "quantity_rejected",
    label: "Rejected",
    render: (value: number) => value.toLocaleString(),
  },
  {
    key: "quality_status",
    label: "Quality",
    render: (value: string) => {
      const variants: Record<string, any> = {
        Good: "default",
        Acceptable: "secondary",
        Rejected: "destructive",
      };
      return <Badge variant={variants[value] || "default"}>{value}</Badge>;
    },
  },
  {
    key: "is_depleted",
    label: "Status",
    render: (value: boolean) => (
      <Badge variant={value ? "secondary" : "default"}>
        {value ? "Depleted" : "Active"}
      </Badge>
    ),
  },
];

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

      {/* Batches Table */}
      <DataTable
        columns={batchColumns}
        data={filteredBatches}
        title=""
        searchable={true}
        onEdit={handleEdit}
      />

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
