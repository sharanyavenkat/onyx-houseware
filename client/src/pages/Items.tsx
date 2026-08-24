import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Item, Accessory, BomComponent } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Search } from "lucide-react";
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
    name: "desired_safety_stock",
    label: "Desired Safety Stock",
    type: "number" as const,
    placeholder: "",
    required: true,
  },
  {
    name: "unit_weight_kg",
    label: "Finished Weight",
    type: "weight" as const,
    placeholder: "Used to reconcile ingot sent vs. castings received",
  },
  {
    name: "finish",
    label: "Finish",
    type: "select" as const,
    options: [
      { value: "none", label: "N/A" },
      { value: "bare", label: "Bare Casting" },
      { value: "nonstick", label: "Non-Stick Coated" },
      { value: "ceramic", label: "Ceramic Coated" },
    ],
  },
  {
    name: "is_kit",
    label: "Is this a kit / combo pack?",
    type: "select" as const,
    required: true,
    options: [
      { value: "false", label: "No — a regular SKU" },
      { value: "true", label: "Yes — a kit assembled from other items/accessories" },
    ],
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

// Bare item link needs the live items list, so it's built dynamically rather
// than as a static option list — only meaningful for coated items (finish =
// nonstick/ceramic); this is what lets Coating Conversions know which bare
// casting a coated SKU actually comes from.
const getBareItemField = (allItems: Item[], currentItemId?: number) => ({
  name: "bare_item_id",
  label: "Bare Item (for coated SKUs only — not used for kits, which use BOM contents instead)",
  type: "select" as const,
  options: [
    { value: "none", label: "N/A / not a coated item" },
    ...allItems
      .filter((i) => i.is_active && !i.is_kit && (!i.finish || i.finish === "bare") && i.id !== currentItemId)
      .map((i) => ({ value: i.id.toString(), label: `${i.name} (${i.sku})` })),
  ],
});

const getItemColumns = (onManageBom: (item: Item) => void) => [
  { key: "name", label: "Product Name", isPrimary: true },
  { key: "sku", label: "SKU" },
  { key: "size_specification", label: "Size/Spec" },
  {
    key: "is_kit",
    label: "Type",
    render: (value: boolean, row: Item) =>
      value ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline">Kit</Badge>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onManageBom(row);
            }}
          >
            Manage Contents
          </Button>
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">SKU</span>
      ),
  },
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
  const [bomEditorItem, setBomEditorItem] = useState<Item | null>(null);
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

  const [searchTerm, setSearchTerm] = useState("");
  const searchedItems = useMemo(() => {
    if (!searchTerm.trim()) return sortedItems;
    const q = searchTerm.toLowerCase();
    return sortedItems.filter(
      (i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
    );
  }, [sortedItems, searchTerm]);

  // Group by kit vs. casting finish — this is how the catalog is actually
  // organized (bare/nonstick/ceramic castings, plus kits/combos), so browsing
  // by group beats one long flat list once you have more than a handful of SKUs.
  const GROUP_ORDER = ["kit", "bare", "nonstick", "ceramic", "ungrouped"] as const;
  const GROUP_LABELS: Record<(typeof GROUP_ORDER)[number], string> = {
    kit: "Kits / Combos",
    bare: "Bare Castings",
    nonstick: "Non-Stick Coated",
    ceramic: "Ceramic Coated",
    ungrouped: "Ungrouped",
  };
  const groupedItems = useMemo(() => {
    const groups: Record<string, Item[]> = { kit: [], bare: [], nonstick: [], ceramic: [], ungrouped: [] };
    for (const item of searchedItems) {
      if (item.is_kit) groups.kit.push(item);
      else if (item.finish === "bare" || item.finish === "nonstick" || item.finish === "ceramic") groups[item.finish].push(item);
      else groups.ungrouped.push(item);
    }
    return groups;
  }, [searchedItems]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["kit", "bare", "nonstick", "ceramic", "ungrouped"])
  );
  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      // Weight changes here directly affect the Vendors page's metal
      // reconciliation math, which is cached under this key.
      queryClient.invalidateQueries({ queryKey: ["/api/casters"] });
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
    const isKit = data.is_kit === "true";
    const processedData = {
      ...data,
      is_active: data.is_active === "true",
      is_kit: isKit,
      // Price isn't tracked here (handled separately, changes with raw
      // material cost) — no longer a form field, just preserve whatever
      // was there on edit, or default to 0 on create.
      price: editingItem ? editingItem.price : 0,
      desired_safety_stock: parseInt(data.desired_safety_stock),
      // Kits are never cast themselves — no weight of their own to reconcile
      unit_weight_kg: isKit ? null : (data.unit_weight_kg ? parseFloat(data.unit_weight_kg) : null),
      finish: isKit ? null : (data.finish === "none" ? null : data.finish),
      // Only meaningful for coated finishes — a bare item or kit has no bare source of its own
      bare_item_id:
        isKit || !data.finish || data.finish === "none" || data.finish === "bare" || data.bare_item_id === "none" || !data.bare_item_id
          ? null
          : parseInt(data.bare_item_id),
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: processedData });
    } else {
      createMutation.mutate(processedData);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-items">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold">Items</h1>
        {canMutate && (
          <Button onClick={handleAdd} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {GROUP_ORDER.map((groupKey) => {
          const groupItems = groupedItems[groupKey];
          if (groupItems.length === 0) return null;
          const isOpen = expandedGroups.has(groupKey);
          return (
            <Collapsible key={groupKey} open={isOpen} onOpenChange={() => toggleGroup(groupKey)}>
              <Card>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full text-left">
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                      <CardTitle className="text-base">
                        {GROUP_LABELS[groupKey]}
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({groupItems.length})
                        </span>
                      </CardTitle>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </CardHeader>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <DataTable
                      columns={getItemColumns(setBomEditorItem)}
                      data={groupItems}
                      title=""
                      searchable={false}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      canMutate={canMutate}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
        {searchedItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No items match your search.</p>
        )}
      </div>

      <FormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmit}
        title={editingItem ? "Edit Item" : "Add New Item"}
        fields={
          editingItem?.is_kit
            ? itemFields
            : [...itemFields.slice(0, 6), getBareItemField(items, editingItem?.id), ...itemFields.slice(6)]
        }
        initialData={
          editingItem
            ? {
                ...editingItem,
                is_active: editingItem.is_active ? "true" : "false",
                is_kit: editingItem.is_kit ? "true" : "false",
                finish: editingItem.finish ?? "none",
                bare_item_id: editingItem.bare_item_id?.toString() ?? "none",
                desired_safety_stock: editingItem.desired_safety_stock || "0",
                unit_weight_kg: editingItem.unit_weight_kg ?? "",
              }
            : { is_active: "true", is_kit: "false", finish: "none", bare_item_id: "none" }
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

      <BomEditorModal
        kitItem={bomEditorItem}
        onClose={() => setBomEditorItem(null)}
        allItems={items}
      />
    </div>
  );
}

type BomRow = {
  key: string; // stable local key for React, not the same as DB id
  id?: number; // present once saved to the DB
  component_type: "item" | "accessory";
  component_item_id?: number;
  component_accessory_id?: number;
  qty_per_kit: number;
};

function bomComponentToRow(c: BomComponent): BomRow {
  return {
    key: `saved-${c.id}`,
    id: c.id,
    component_type: c.component_type as "item" | "accessory",
    component_item_id: c.component_item_id ?? undefined,
    component_accessory_id: c.component_accessory_id ?? undefined,
    qty_per_kit: c.qty_per_kit,
  };
}

function BomEditorModal({
  kitItem,
  onClose,
  allItems,
}: {
  kitItem: Item | null;
  onClose: () => void;
  allItems: Item[];
}) {
  const { toast } = useToast();
  const { canMutate } = useAuth();
  const isOpen = !!kitItem;

  const { data: existingComponents = [], isLoading } = useQuery<BomComponent[]>({
    queryKey: ["/api/bom-components/by-parent", kitItem?.id],
    queryFn: async () => {
      const res = await fetch(`/api/bom-components/by-parent/${kitItem?.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch kit contents");
      return res.json();
    },
    enabled: isOpen,
  });

  const { data: accessories = [] } = useQuery<Accessory[]>({
    queryKey: ["/api/accessories"],
    enabled: isOpen,
  });

  const [rows, setRows] = useState<BomRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Load fetched components into editable local state whenever the modal
  // opens for a (possibly different) kit
  useEffect(() => {
    if (isOpen) {
      setRows(existingComponents.map(bomComponentToRow));
    }
  }, [isOpen, kitItem?.id, existingComponents]);

  const baseComponentItemOptions = useMemo(
    () => allItems.filter(i => i.is_active && !i.is_kit && i.id !== kitItem?.id),
    [allItems, kitItem]
  );
  const baseAccessoryOptions = useMemo(
    () => accessories.filter(a => a.status === "active"),
    [accessories]
  );

  // Excludes components already used in OTHER rows of this same kit, so the
  // same SKU/accessory can't accidentally end up as two separate rows —
  // that would silently double-deduct it on every kit shipment.
  const getComponentItemOptionsForRow = (currentKey: string) => {
    const usedElsewhere = new Set(
      rows.filter(r => r.key !== currentKey && r.component_type === "item").map(r => r.component_item_id)
    );
    return baseComponentItemOptions.filter(i => !usedElsewhere.has(i.id));
  };
  const getAccessoryOptionsForRow = (currentKey: string) => {
    const usedElsewhere = new Set(
      rows.filter(r => r.key !== currentKey && r.component_type === "accessory").map(r => r.component_accessory_id)
    );
    return baseAccessoryOptions.filter(a => !usedElsewhere.has(a.id));
  };

  const addRow = () => {
    setRows(prev => [
      ...prev,
      { key: `new-${Date.now()}-${Math.random()}`, component_type: "item", qty_per_kit: 1 },
    ]);
  };

  const removeRow = (key: string) => {
    setRows(prev => prev.filter(r => r.key !== key));
  };

  const updateRow = (key: string, patch: Partial<BomRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    if (!kitItem) return;

    // Validate every row has a component selected and a positive quantity
    for (const row of rows) {
      const hasComponent = row.component_type === "item" ? !!row.component_item_id : !!row.component_accessory_id;
      if (!hasComponent) {
        toast({ title: "Every row needs a component selected", variant: "destructive" });
        return;
      }
      if (!row.qty_per_kit || row.qty_per_kit < 1) {
        toast({ title: "Quantity per kit must be at least 1", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      const currentIds = new Set(rows.filter(r => r.id).map(r => r.id));
      const removed = existingComponents.filter(c => !currentIds.has(c.id));

      for (const c of removed) {
        await apiRequest("DELETE", `/api/bom-components/${c.id}`);
      }

      for (const row of rows) {
        const payload = {
          parent_item_id: kitItem.id,
          component_type: row.component_type,
          component_item_id: row.component_type === "item" ? row.component_item_id : null,
          component_accessory_id: row.component_type === "accessory" ? row.component_accessory_id : null,
          qty_per_kit: row.qty_per_kit,
        };
        if (row.id) {
          const original = existingComponents.find(c => c.id === row.id);
          const changed =
            original &&
            (original.component_type !== payload.component_type ||
              original.component_item_id !== payload.component_item_id ||
              original.component_accessory_id !== payload.component_accessory_id ||
              original.qty_per_kit !== payload.qty_per_kit);
          if (changed) {
            await apiRequest("PATCH", `/api/bom-components/${row.id}`, payload);
          }
        } else {
          await apiRequest("POST", "/api/bom-components", payload);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/bom-components/by-parent", kitItem.id] });
      toast({ title: "Kit contents saved" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error saving kit contents", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kit Contents — {kitItem?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            What one unit of this kit is assembled from. Shipping this kit deducts these quantities automatically from each component's stock.
          </p>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2">
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No components yet — add one below.</p>
              )}
              {rows.map(row => (
                <div key={row.key} className="flex gap-2 items-start border rounded-md p-2">
                  <Select
                    value={row.component_type}
                    onValueChange={(v) => updateRow(row.key, { component_type: v as "item" | "accessory", component_item_id: undefined, component_accessory_id: undefined })}
                    disabled={!canMutate}
                  >
                    <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item">Item</SelectItem>
                      <SelectItem value="accessory">Accessory</SelectItem>
                    </SelectContent>
                  </Select>

                  {row.component_type === "item" ? (
                    <Select
                      value={row.component_item_id?.toString() || ""}
                      onValueChange={(v) => updateRow(row.key, { component_item_id: parseInt(v) })}
                      disabled={!canMutate}
                    >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select item..." /></SelectTrigger>
                      <SelectContent>
                        {getComponentItemOptionsForRow(row.key).map(i => (
                          <SelectItem key={i.id} value={i.id.toString()}>{i.name} ({i.sku})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={row.component_accessory_id?.toString() || ""}
                      onValueChange={(v) => updateRow(row.key, { component_accessory_id: parseInt(v) })}
                      disabled={!canMutate}
                    >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select accessory..." /></SelectTrigger>
                      <SelectContent>
                        {getAccessoryOptionsForRow(row.key).map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Input
                    type="number"
                    min="1"
                    className="w-20 shrink-0"
                    value={row.qty_per_kit}
                    onChange={(e) => updateRow(row.key, { qty_per_kit: parseInt(e.target.value) || 1 })}
                    disabled={!canMutate}
                    placeholder="Qty"
                  />

                  {canMutate && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.key)} className="shrink-0 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {canMutate && (
                <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Component
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            {canMutate && (
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Kit Contents"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
