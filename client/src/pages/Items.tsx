import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Item } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";

const itemFields = [
  {
    name: "name",
    label: "Product Name",
    type: "text" as const,
    required: true,
    placeholder: "Enter product name",
  },
  {
    name: "sku",
    label: "SKU",
    type: "text" as const,
    required: true,
    placeholder: "Enter SKU code",
  },
  {
    name: "size_specification",
    label: "Size/Specification",
    type: "text" as const,
    required: true,
    placeholder: "e.g., 280mm, 12 pits, Standard",
  },
  {
    name: "price",
    label: "Price (₹)",
    type: "number" as const,
    required: true,
    placeholder: "",
  },
  {
    name: "desired_safety_stock",
    label: "Desired Safety Stock",
    type: "number" as const,
    placeholder: "",
    required: true,
  },
  {
    name: "is_active",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  },
  {
    name: "notes",
    label: "Notes",
    type: "textarea" as const,
    placeholder: "Additional notes (e.g., still developing)...",
  },
];

const itemColumns = [
  { key: "name", label: "Product Name", isPrimary: true },
  { key: "sku", label: "SKU" },
  { key: "size_specification", label: "Size/Spec" },
  {
    key: "price",
    label: "Price",
    render: (value: string) =>
      value ? `₹${parseFloat(value).toFixed(2)}` : "-",
  },
  { key: "desired_safety_stock", label: "Desired Safety Stock", hideOnMobile: true },
  {
    key: "is_active",
    label: "Status",
    render: (value: boolean) => (
      <Badge variant={value ? "default" : "secondary"}>
        {value ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

export default function Items() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const { toast } = useToast();
  const { canMutate } = useAuth();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

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

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/items", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Item created successfully" });
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/items/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Item updated successfully" });
      setIsModalOpen(false);
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Item deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (item: Item) => {
    setItemToDelete(item);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete.id);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleSubmit = (data: any) => {
    const processedData = {
      ...data,
      is_active: data.is_active === "true",
      price: parseFloat(data.price),
      desired_safety_stock: parseInt(data.desired_safety_stock),
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: processedData });
    } else {
      createMutation.mutate(processedData);
    }
  };

  console.log("items: ", items);
  console.log("editingItem: ", editingItem);
  return (
    <div className="space-y-6" data-testid="page-items">
      <DataTable
        columns={itemColumns}
        data={sortedItems}
        title="Items"
        addButtonLabel="Add Item"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canMutate={canMutate}
      />

      <FormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmit}
        title={editingItem ? "Edit Item" : "Add New Item"}
        fields={itemFields}
        initialData={
          editingItem
            ? {
                ...editingItem,
                is_active: editingItem.is_active ? "true" : "false",
                price: editingItem.price || "0",
                desired_safety_stock: editingItem.desired_safety_stock || "0",
              }
            : { is_active: "true" }
        }
        submitLabel={editingItem ? "Update Item" : "Add Item"}
      />

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Item"
        description={`Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
