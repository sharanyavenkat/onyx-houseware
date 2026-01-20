import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate, toInputDate } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Invoice, Shipment } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Edit } from "lucide-react";
import { useState, useMemo } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { Badge } from "@/components/ui/badge";

interface InvoiceSectionProps {
  orderId: number;
  shipments: Shipment[];
  items: any[];
}

export default function InvoiceSection({ orderId, shipments, items }: InvoiceSectionProps) {
  const { toast } = useToast();
  const { canMutate } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);
  
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<number[]>([]);

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices/order", orderId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/order/${orderId}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/invoices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", "order", orderId] });
      toast({ title: "Invoice created successfully" });
      resetForm();
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/invoices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", "order", orderId] });
      toast({ title: "Invoice updated successfully" });
      resetForm();
      setIsFormOpen(false);
      setEditingInvoice(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", "order", orderId] });
      toast({ title: "Invoice deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setInvoiceNumber("");
    setInvoiceDate("");
    setNotes("");
    setSelectedShipmentIds([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceNumber) {
      toast({
        title: "Please enter an invoice number",
        variant: "destructive",
      });
      return;
    }

    const data = {
      order_id: orderId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate || null,
      notes: notes || null,
      shipment_ids: selectedShipmentIds,
    };

    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setInvoiceNumber(invoice.invoice_number);
    setInvoiceDate(invoice.invoice_date ? toInputDate(invoice.invoice_date) : "");
    setNotes(invoice.notes || "");
    const assignedShipments = shipments.filter(s => s.invoice_id === invoice.id);
    setSelectedShipmentIds(assignedShipments.map(s => s.id));
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    setInvoiceToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (invoiceToDelete !== null) {
      deleteMutation.mutate(invoiceToDelete);
      setIsConfirmOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const toggleShipment = (shipmentId: number) => {
    setSelectedShipmentIds(prev => 
      prev.includes(shipmentId) 
        ? prev.filter(id => id !== shipmentId)
        : [...prev, shipmentId]
    );
  };

  const getItemName = (orderItemId: number) => {
    const item = items.find(i => i.order_item_id === orderItemId);
    return item?.item_name || "Unknown Item";
  };

  const getShipmentDisplay = (shipment: Shipment) => {
    const itemName = getItemName(shipment.order_item_id);
    return `${shipment.shipment_number || `#${shipment.id}`} - ${itemName} x${shipment.quantity_shipped}`;
  };

  const getInvoiceSummary = (invoice: Invoice) => {
    const linkedShipments = shipments.filter(s => s.invoice_id === invoice.id);
    if (linkedShipments.length === 0) return "No shipments linked";

    const itemSummary: Record<string, number> = {};
    linkedShipments.forEach(s => {
      const itemName = getItemName(s.order_item_id);
      if (!itemSummary[itemName]) {
        itemSummary[itemName] = 0;
      }
      itemSummary[itemName] += s.quantity_shipped;
    });

    return Object.entries(itemSummary)
      .map(([name, shipped]) => `${name} x${shipped}`)
      .join(", ");
  };

  const unassignedShipments = useMemo(() => {
    return shipments.filter(s => !s.invoice_id);
  }, [shipments]);

  const availableShipmentsForForm = useMemo(() => {
    if (editingInvoice) {
      return shipments.filter(s => !s.invoice_id || s.invoice_id === editingInvoice.id);
    }
    return unassignedShipments;
  }, [shipments, editingInvoice, unassignedShipments]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices
          </CardTitle>
          {canMutate && (
            <Button
              size="sm"
              onClick={() => {
                setEditingInvoice(null);
                resetForm();
                setIsFormOpen(true);
              }}
              data-testid="button-add-invoice"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Invoice
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length > 0 ? (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const linkedShipments = shipments.filter(s => s.invoice_id === invoice.id);
              return (
                <div
                  key={invoice.id}
                  className="border rounded-md p-4"
                  data-testid={`invoice-${invoice.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{invoice.invoice_number}</span>
                        {invoice.invoice_date && (
                          <Badge variant="outline" className="text-xs">
                            {formatDate(invoice.invoice_date)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getInvoiceSummary(invoice)}
                      </p>
                      {linkedShipments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {linkedShipments.map(s => (
                            <Badge key={s.id} variant="secondary" className="text-xs">
                              {s.shipment_number || `SHP-${s.id}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {invoice.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          {invoice.notes}
                        </p>
                      )}
                    </div>
                    {canMutate && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(invoice)}
                          data-testid={`button-edit-invoice-${invoice.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(invoice.id)}
                          data-testid={`button-delete-invoice-${invoice.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No invoices recorded yet. Click "Add Invoice" to track invoice numbers.
          </p>
        )}

        {unassignedShipments.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {unassignedShipments.length} shipment(s) not yet linked to an invoice
            </p>
          </div>
        )}
      </CardContent>

      <Dialog open={isFormOpen} onOpenChange={(open) => {
        if (!open) {
          resetForm();
          setEditingInvoice(null);
        }
        setIsFormOpen(open);
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? "Edit Invoice" : "Add Invoice"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="invoice_number">
                Invoice Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g., INV-001"
                data-testid="input-invoice-number"
              />
            </div>

            <div>
              <Label htmlFor="invoice_date">Invoice Date (Optional)</Label>
              <Input
                id="invoice_date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                data-testid="input-invoice-date"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this invoice"
                data-testid="input-invoice-notes"
              />
            </div>

            {availableShipmentsForForm.length > 0 && (
              <div>
                <Label className="mb-2 block">Link Shipments</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {availableShipmentsForForm.map((shipment) => (
                    <div key={shipment.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`shipment-${shipment.id}`}
                        checked={selectedShipmentIds.includes(shipment.id)}
                        onCheckedChange={() => toggleShipment(shipment.id)}
                        data-testid={`checkbox-shipment-${shipment.id}`}
                      />
                      <label
                        htmlFor={`shipment-${shipment.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {getShipmentDisplay(shipment)}
                        <span className="text-muted-foreground ml-2">
                          ({formatDate(shipment.shipment_date)})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableShipmentsForForm.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No shipments available to link. Record shipments first using "Track Shipments".
              </p>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(false);
                  setEditingInvoice(null);
                }}
                data-testid="button-cancel-invoice"
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="button-save-invoice">
                {editingInvoice ? "Update Invoice" : "Save Invoice"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice? Shipments linked to this invoice will be unassigned."
      />
    </Card>
  );
}
