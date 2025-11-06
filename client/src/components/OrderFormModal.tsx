import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Item } from "@shared/schema";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  title: string;
  initialData?: any;
  submitLabel: string;
  customers: Array<{ value: string; label: string }>;
  items: Item[];
}

interface LineItem {
  item_id: number;
  item_name: string;
  sku: string;
  quantity: number;
}

export default function OrderFormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialData = {},
  submitLabel,
  customers,
  items = [],
}: OrderFormModalProps) {
  const [poNumber, setPoNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [fulfillmentDate, setFulfillmentDate] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeItems = items.filter((item) => item.is_active);

  useEffect(() => {
    if (isOpen) {
      setPoNumber(initialData.po_number || "");
      setCustomerId(initialData.customer_id || "");
      setOrderDate(initialData.order_date || "");
      setFulfillmentDate(initialData.fulfillment_date || "");
      setStatus(initialData.status || "");
      setNotes(initialData.notes || "");
      setLineItems(initialData.line_items || []);
      setErrors({});
    }
  }, [isOpen, initialData]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { item_id: 0, item_name: "", sku: "", quantity: 1 },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const newLineItems = [...lineItems];
    if (field === "item_id") {
      const selectedItem = activeItems.find(
        (item) => item.id === parseInt(value)
      );
      if (selectedItem) {
        newLineItems[index] = {
          item_id: selectedItem.id,
          item_name: selectedItem.name,
          sku: selectedItem.sku,
          quantity: newLineItems[index].quantity,
        };
      }
    } else if (field === "quantity") {
      newLineItems[index][field] = parseInt(value) || 0;
    }
    setLineItems(newLineItems);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!poNumber.trim()) {
      newErrors.po_number = "PO Number is required";
    }
    if (!customerId) {
      newErrors.customer_id = "Customer is required";
    }
    if (!status) {
      newErrors.status = "Status is required";
    }
    if (lineItems.length === 0) {
      newErrors.line_items = "At least one item is required";
    }

    const itemIds = lineItems.map((li) => li.item_id).filter((id) => id > 0);
    const uniqueItemIds = new Set(itemIds);
    if (itemIds.length !== uniqueItemIds.size) {
      newErrors.line_items_duplicate =
        "Cannot add the same item multiple times";
    }

    lineItems.forEach((item, index) => {
      if (!item.item_id || item.item_id === 0) {
        newErrors[`line_item_${index}_item`] = "Please select an item";
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`line_item_${index}_quantity`] =
          "Quantity must be greater than 0";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const formData = {
      po_number: poNumber,
      customer_id: parseInt(customerId),
      order_date: orderDate,
      fulfillment_date: fulfillmentDate || null,
      status,
      notes,
      line_items: lineItems,
    };

    onSubmit(formData);
  };

  const getAvailableItems = (currentIndex: number) => {
    const selectedItemIds = lineItems
      .map((li, idx) => (idx !== currentIndex ? li.item_id : null))
      .filter((id) => id !== null);

    return activeItems.filter((item) => !selectedItemIds.includes(item.id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 flex-1 overflow-y-auto pr-2"
        >
          <div>
            <Label htmlFor="po_number">
              PO Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="po_number"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Enter unique PO number"
              data-testid="input-po-number"
            />
            {errors.po_number && (
              <p className="text-sm text-destructive mt-1">
                {errors.po_number}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="customer_id">
              Customer <span className="text-destructive">*</span>
            </Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="customer_id" data-testid="select-customer">
                <SelectValue placeholder="Select Customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.value} value={customer.value}>
                    {customer.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customer_id && (
              <p className="text-sm text-destructive mt-1">
                {errors.customer_id}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="order_date">Order Date</Label>
            <Input
              id="order_date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              data-testid="input-order-date"
            />
          </div>

          <div>
            <Label htmlFor="fulfillment_date">Fulfillment Date</Label>
            <Input
              id="fulfillment_date"
              type="date"
              value={fulfillmentDate}
              onChange={(e) => setFulfillmentDate(e.target.value)}
              data-testid="input-fulfillment-date"
            />
          </div>

          <div>
            <Label htmlFor="status">
              Status <span className="text-destructive">*</span>
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status" data-testid="select-status">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-destructive mt-1">{errors.status}</p>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">
                Order Items <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                data-testid="button-add-line-item"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {errors.line_items && (
              <p className="text-sm text-destructive mb-2">
                {errors.line_items}
              </p>
            )}
            {errors.line_items_duplicate && (
              <p className="text-sm text-destructive mb-2">
                {errors.line_items_duplicate}
              </p>
            )}

            <div className="space-y-3">
              {lineItems.map((lineItem, index) => (
                <div
                  key={index}
                  className="flex gap-2 items-start p-3 border rounded-md"
                  data-testid={`line-item-${index}`}
                >
                  <div className="flex-1">
                    <Label className="text-xs">Item</Label>
                    <Select
                      value={lineItem.item_id.toString()}
                      onValueChange={(value) =>
                        updateLineItem(index, "item_id", value)
                      }
                    >
                      <SelectTrigger data-testid={`select-line-item-${index}`}>
                        <SelectValue placeholder="Select Item" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableItems(index).map((item) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.name} ({item.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors[`line_item_${index}_item`] && (
                      <p className="text-xs text-destructive mt-1">
                        {errors[`line_item_${index}_item`]}
                      </p>
                    )}
                  </div>

                  <div className="w-32">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={lineItem.quantity}
                      onChange={(e) =>
                        updateLineItem(index, "quantity", e.target.value)
                      }
                      data-testid={`input-quantity-${index}`}
                    />
                    {errors[`line_item_${index}_quantity`] && (
                      <p className="text-xs text-destructive mt-1">
                        {errors[`line_item_${index}_quantity`]}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(index)}
                    className="mt-5"
                    data-testid={`button-remove-line-item-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {lineItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items added yet. Click "Add Item" to add products to this
                  order.
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              data-testid="input-notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 flex-shrink-0 border-t -mx-2 px-2 -mb-4 pb-0 bg-background sticky bottom-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" data-testid="button-submit">
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
