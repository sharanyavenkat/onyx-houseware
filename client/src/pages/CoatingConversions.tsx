import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/dateUtils";
import type { Item, Caster, CoatingConversion } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

type ConversionWithNames = CoatingConversion & {
  bare_item_name: string;
  coated_item_name: string;
  caster_name: string;
};

export default function CoatingConversions() {
  const { toast } = useToast();
  const { canMutate } = useAuth();

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [receivingConversion, setReceivingConversion] = useState<ConversionWithNames | null>(null);
  const [editingConversion, setEditingConversion] = useState<ConversionWithNames | null>(null);
  const [deletingConversion, setDeletingConversion] = useState<ConversionWithNames | null>(null);

  const { data: conversions = [] } = useQuery<ConversionWithNames[]>({
    queryKey: ["/api/coating-conversions"],
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const { data: casters = [] } = useQuery<Caster[]>({
    queryKey: ["/api/casters"],
  });

  // Bare = active, not a kit, no finish tag (or explicitly 'bare')
  const bareItems = useMemo(
    () => items.filter(i => i.is_active && !i.is_kit && (!i.finish || i.finish === "bare")),
    [items]
  );
  const coaters = useMemo(() => casters.filter(c => c.status === "active"), [casters]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/coating-conversions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coating-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
      toast({ title: "Conversion deleted, stock reversed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting conversion", description: error.message, variant: "destructive" });
    },
  });

  const pendingConversions = conversions.filter(c => c.status === "pending");
  const receivedConversions = conversions.filter(c => c.status === "received");

  return (
    <div className="space-y-6" data-testid="page-coating-conversions">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Coating Conversions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bare castings sent for coating, coated pieces received back. Deducts from bare stock on send, adds to coated stock on receive — regardless of whether this is paper-trailed as a Delivery Chalan or Sale Invoice on the accounting side.
          </p>
        </div>
        {canMutate && (
          <Button onClick={() => setIsSendModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Send for Coating
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending ({pendingConversions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingConversions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending conversions.</p>
          ) : (
            <div className="border rounded-md divide-y">
              {pendingConversions.map(c => (
                <div key={c.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" data-testid={`conversion-pending-${c.id}`}>
                  <div>
                    <div className="font-medium">
                      {c.bare_item_name} → {c.coated_item_name}
                      {c.color && <Badge variant="outline" className="ml-2">{c.color}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Sent {formatDate(c.sent_date)} · {c.quantity_sent} pcs {c.caster_name && `· ${c.caster_name}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canMutate && (
                      <>
                        <Button size="sm" onClick={() => setReceivingConversion(c)}>
                          Receive
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingConversion(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeletingConversion(c)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Received ({receivedConversions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {receivedConversions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No conversions received yet.</p>
          ) : (
            <div className="border rounded-md divide-y">
              {receivedConversions.map(c => (
                <div key={c.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" data-testid={`conversion-received-${c.id}`}>
                  <div>
                    <div className="font-medium">
                      {c.bare_item_name} → {c.coated_item_name}
                      {c.color && <Badge variant="outline" className="ml-2">{c.color}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Sent {formatDate(c.sent_date)} ({c.quantity_sent} pcs) · Received {c.received_date && formatDate(c.received_date)}
                      {" "}({c.quantity_received} pcs, {c.quantity_rejected} rejected at our QC)
                      {c.caster_name && ` · ${c.caster_name}`}
                    </div>
                  </div>
                  {canMutate && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingConversion(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeletingConversion(c)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SendForCoatingModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        bareItems={bareItems}
        allItems={items}
        coaters={coaters}
      />

      {receivingConversion && (
        <ReceiveCoatingModal
          conversion={receivingConversion}
          onClose={() => setReceivingConversion(null)}
        />
      )}

      {editingConversion && (
        <EditConversionModal
          conversion={editingConversion}
          coaters={coaters}
          onClose={() => setEditingConversion(null)}
        />
      )}

      <ConfirmDialog
        open={deletingConversion !== null}
        onOpenChange={(open) => !open && setDeletingConversion(null)}
        onConfirm={() => {
          if (deletingConversion) {
            deleteMutation.mutate(deletingConversion.id);
            setDeletingConversion(null);
          }
        }}
        title="Delete Coating Conversion"
        description={
          deletingConversion?.status === "received"
            ? "This will restore the bare stock sent and remove the coated batch it produced (only allowed if none of that coated stock has shipped yet)."
            : "This will restore the bare stock that was sent for coating."
        }
        confirmText="Delete"
      />
    </div>
  );
}

function SendForCoatingModal({
  isOpen,
  onClose,
  bareItems,
  allItems,
  coaters,
}: {
  isOpen: boolean;
  onClose: () => void;
  bareItems: Item[];
  allItems: Item[];
  coaters: Caster[];
}) {
  const { toast } = useToast();
  const [bareItemId, setBareItemId] = useState("");
  const [coatedItemId, setCoatedItemId] = useState("");
  const [casterId, setCasterId] = useState("none");
  const [quantitySent, setQuantitySent] = useState("");
  const [sentDate, setSentDate] = useState(new Date().toISOString().split("T")[0]);
  const [color, setColor] = useState("");

  const coatedOptions = useMemo(
    () => allItems.filter(i => i.is_active && !i.is_kit && i.bare_item_id === parseInt(bareItemId || "0")),
    [allItems, bareItemId]
  );

  const resetForm = () => {
    setBareItemId("");
    setCoatedItemId("");
    setCasterId("none");
    setQuantitySent("");
    setSentDate(new Date().toISOString().split("T")[0]);
    setColor("");
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/coating-conversions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coating-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
      toast({ title: "Sent for coating" });
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error sending for coating", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantitySent);
    if (!bareItemId || !coatedItemId || !qty || qty <= 0 || !sentDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      bare_item_id: parseInt(bareItemId),
      coated_item_id: parseInt(coatedItemId),
      caster_id: casterId === "none" ? null : parseInt(casterId),
      quantity_sent: qty,
      sent_date: sentDate,
      color: color || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send for Coating</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Bare Item</Label>
            <Select value={bareItemId} onValueChange={(v) => { setBareItemId(v); setCoatedItemId(""); }}>
              <SelectTrigger data-testid="select-bare-item"><SelectValue placeholder="Select bare casting" /></SelectTrigger>
              <SelectContent>
                {bareItems.map(i => (
                  <SelectItem key={i.id} value={i.id.toString()}>{i.name} ({i.sku})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Coated Item</Label>
            <Select value={coatedItemId} onValueChange={setCoatedItemId} disabled={!bareItemId}>
              <SelectTrigger data-testid="select-coated-item"><SelectValue placeholder={bareItemId ? "Select coated SKU" : "Pick a bare item first"} /></SelectTrigger>
              <SelectContent>
                {coatedOptions.length === 0 ? (
                  <SelectItem value="none" disabled>No coated SKU linked to this bare item yet — set it on the Items page</SelectItem>
                ) : (
                  coatedOptions.map(i => (
                    <SelectItem key={i.id} value={i.id.toString()}>{i.name} ({i.sku})</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Coater (Optional)</Label>
            <Select value={casterId} onValueChange={setCasterId}>
              <SelectTrigger data-testid="select-coater"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {coaters.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity Sent</Label>
              <Input type="number" min="1" value={quantitySent} onChange={(e) => setQuantitySent(e.target.value)} data-testid="input-quantity-sent" />
            </div>
            <div>
              <Label>Sent Date</Label>
              <Input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} data-testid="input-sent-date" />
            </div>
          </div>
          <div>
            <Label>Color / Variant (Optional)</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black, Ivory — if known at send time" data-testid="input-send-color" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Sending..." : "Send for Coating"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveCoatingModal({
  conversion,
  onClose,
}: {
  conversion: ConversionWithNames;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [quantityReceived, setQuantityReceived] = useState(conversion.quantity_sent.toString());
  const [quantityRejected, setQuantityRejected] = useState("0");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [color, setColor] = useState("");

  const receiveMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/coating-conversions/${conversion.id}/receive`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coating-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
      toast({ title: "Received — new coated batch created" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error receiving conversion", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const received = parseInt(quantityReceived);
    const rejected = parseInt(quantityRejected);
    if (isNaN(received) || received < 0 || isNaN(rejected) || rejected < 0 || !receivedDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    if (rejected > received) {
      toast({ title: "Rejected can't exceed received", variant: "destructive" });
      return;
    }
    receiveMutation.mutate({
      quantity_received: received,
      quantity_rejected: rejected,
      received_date: receivedDate,
      color: color || null,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Coating — {conversion.coated_item_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sent {conversion.quantity_sent} pcs of {conversion.bare_item_name} on {formatDate(conversion.sent_date)}.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity Received</Label>
              <Input type="number" min="0" value={quantityReceived} onChange={(e) => setQuantityReceived(e.target.value)} data-testid="input-quantity-received" />
            </div>
            <div>
              <Label>Rejected at Our QC</Label>
              <Input type="number" min="0" value={quantityRejected} onChange={(e) => setQuantityRejected(e.target.value)} data-testid="input-quantity-rejected" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Received Date</Label>
              <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} data-testid="input-received-date" />
            </div>
            <div>
              <Label>Color (Optional)</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black, Ivory" data-testid="input-color" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? "Saving..." : "Confirm Received"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditConversionModal({
  conversion,
  coaters,
  onClose,
}: {
  conversion: CoatingConversion & { bare_item_name: string; coated_item_name: string; caster_name: string };
  coaters: Caster[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [color, setColor] = useState(conversion.color || "");
  const [casterId, setCasterId] = useState(conversion.caster_id ? conversion.caster_id.toString() : "none");
  const [sentDate, setSentDate] = useState(conversion.sent_date);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/coating-conversions/${conversion.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coating-conversions"] });
      toast({ title: "Conversion updated" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error updating conversion", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      color: color || null,
      caster_id: casterId === "none" ? null : parseInt(casterId),
      sent_date: sentDate,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit — {conversion.bare_item_name} → {conversion.coated_item_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Quantity sent and the items involved can't be changed here, since they're already tied to stock that's moved — delete and re-create the conversion if those are wrong. Color, coater, and sent date are safe to edit anytime.
          </p>
          <div>
            <Label>Color / Variant</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black, Ivory" data-testid="input-edit-color" />
          </div>
          <div>
            <Label>Coater</Label>
            <Select value={casterId} onValueChange={setCasterId}>
              <SelectTrigger data-testid="select-edit-coater"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {coaters.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sent Date</Label>
            <Input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} data-testid="input-edit-sent-date" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
