import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Accessory } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";

const accessoryFields = [
  {
    name: "name",
    label: "Accessory Name",
    type: "text" as const,
    required: true,
    placeholder: "e.g., Bakelite Handle (Large)",
  },
  {
    name: "stock_on_hand",
    label: "Stock on Hand",
    type: "number" as const,
    required: true,
    placeholder: "Current quantity available",
  },
  {
    name: "safety_stock",
    label: "Safety Stock Level",
    type: "number" as const,
    required: true,
    placeholder: "Minimum stock to maintain",
  },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "active", label: "Active" },
      { value: "discontinued", label: "Discontinued" },
    ],
  },
  {
    name: "notes",
    label: "Notes",
    type: "textarea" as const,
    placeholder: "Supplier info, ordering notes, etc.",
  },
];

const accessoryColumns = [
  { key: "name", label: "Accessory Name", isPrimary: true },
  { 
    key: "stock_on_hand", 
    label: "Stock",
    render: (value: number, row: any) => {
      const isLow = value <= row.safety_stock;
      return (
        <span className={isLow ? "text-amber-600 dark:text-amber-500 font-medium" : ""}>
          {value}
          {isLow && <span className="ml-1 text-xs">(low)</span>}
        </span>
      );
    }
  },
  { key: "safety_stock", label: "Safety Stock", hideOnMobile: true },
  {
    key: "stock_status",
    label: "Stock Status",
    render: (_: any, row: any) => {
      const isLow = row.stock_on_hand <= row.safety_stock;
      return (
        <Badge variant={isLow ? "secondary" : "default"} className={isLow ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : ""}>
          {isLow ? "Low Stock" : "OK"}
        </Badge>
      );
    },
  },
  {
    key: "status",
    label: "Status",
    render: (value: string) => (
      <Badge variant={value === "active" ? "default" : "secondary"}>
        {value === "active" ? "Active" : "Discontinued"}
      </Badge>
    ),
    hideOnMobile: true,
  },
];

export default function Accessories() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [accessoryToDelete, setAccessoryToDelete] = useState<Accessory | null>(null);
  const { toast } = useToast();
  const { canMutate } = useAuth();

  const { data: accessories = [], isLoading } = useQuery<Accessory[]>({
    queryKey: ["/api/accessories"],
  });

  const sortedAccessories = useMemo(() => {
    return [...accessories].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      const aLow = a.stock_on_hand <= a.safety_stock;
      const bLow = b.stock_on_hand <= b.safety_stock;
      if (aLow !== bLow) {
        return aLow ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [accessories]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/accessories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accessories"] });
      toast({ title: "Accessory created successfully" });
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating accessory",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/accessories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accessories"] });
      toast({ title: "Accessory updated successfully" });
      setIsModalOpen(false);
      setEditingAccessory(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating accessory",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/accessories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accessories"] });
      toast({ title: "Accessory deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting accessory",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    setEditingAccessory(null);
    setIsModalOpen(true);
  };

  const handleEdit = (accessory: Accessory) => {
    setEditingAccessory(accessory);
    setIsModalOpen(true);
  };

  const handleDelete = (accessory: Accessory) => {
    setAccessoryToDelete(accessory);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (accessoryToDelete) {
      deleteMutation.mutate(accessoryToDelete.id);
      setIsConfirmOpen(false);
      setAccessoryToDelete(null);
    }
  };

  const handleSubmit = (data: any) => {
    const formattedData = {
      ...data,
      stock_on_hand: parseInt(data.stock_on_hand) || 0,
      safety_stock: parseInt(data.safety_stock) || 0,
    };

    if (editingAccessory) {
      updateMutation.mutate({ id: editingAccessory.id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const lowStockCount = useMemo(() => {
    return accessories.filter(a => a.status === "active" && a.stock_on_hand <= a.safety_stock).length;
  }, [accessories]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="page-accessories">
      {lowStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200">
          <strong>{lowStockCount}</strong> accessory item{lowStockCount > 1 ? 's are' : ' is'} at or below safety stock level.
        </div>
      )}

      <DataTable
        columns={accessoryColumns}
        data={sortedAccessories}
        title="Accessories"
        addButtonLabel="Add Accessory"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canMutate={canMutate}
      />

      <FormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAccessory(null);
        }}
        onSubmit={handleSubmit}
        title={editingAccessory ? "Edit Accessory" : "Add Accessory"}
        fields={accessoryFields}
        initialData={editingAccessory || { status: "active", stock_on_hand: 0, safety_stock: 0 }}
        submitLabel={editingAccessory ? "Update Accessory" : "Add Accessory"}
      />

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Accessory"
        description={`Are you sure you want to delete "${accessoryToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
