import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import type { Item, Caster, CoatingConversion, CoatingReceipt } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

type ConversionWithNames = CoatingConversion & {
  bare_item_name: string;
  coated_item_name: string;
  caster_name: string;
  receipts: Array<CoatingReceipt & { batch_number: string }>;
};

const stillOut = (c: { quantity_sent: number; quantity_received: number | null }) =>
  c.quantity_sent - (c.quantity_received ?? 0);

type StatusFilter = "open" | "closed" | "all";

export default function CoatingConversions() {
  const { toast } = useToast();
  const { canMutate } = useAuth();

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [receivingConversion, setReceivingConversion] = useState<ConversionWithNames | null>(null);
  const [editingConversion, setEditingConversion] = useState<ConversionWithNames | null>(null);
  const [deletingConversion, setDeletingConversion] = useState<ConversionWithNames | null>(null);
  const [editingLot, setEditingLot] = useState<{ conversion: ConversionWithNames; lot: ConversionWithNames["receipts"][number] } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/coating-conversions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
    queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/stock-ledger") });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/coating-conversions/${id}`),
    onSuccess: () => {
      refreshAll();
      toast({ title: "Conversion deleted, stock reversed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting conversion", description: error.message, variant: "destructive" });
    },
  });

  const undoLotMutation = useMutation({
    mutationFn: async ({ id, receiptId }: { id: number; receiptId: number }) =>
      apiRequest("DELETE", `/api/coating-conversions/${id}/receipts/${receiptId}`),
    onSuccess: () => {
      refreshAll();
      toast({ title: "Lot removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't remove lot", description: error.message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "close" | "reopen" }) =>
      apiRequest("PATCH", `/api/coating-conversions/${id}/${action}`),
    onSuccess: (_d, v) => {
      refreshAll();
      toast({ title: v.action === "close" ? "Send closed" : "Send reopened" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isOpen = (c: ConversionWithNames) => c.status !== "received";
  const openCount = conversions.filter(isOpen).length;
  const closedCount = conversions.length - openCount;

  const vendorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of conversions) seen.set(c.caster_id ? String(c.caster_id) : "none", c.caster_name || "No coater set");
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [conversions]);

  const groups = useMemo(() => {
    const visible = conversions.filter(c =>
      (statusFilter === "all" || (statusFilter === "open") === isOpen(c)) &&
      (vendorFilter === "all" || (c.caster_id ? String(c.caster_id) : "none") === vendorFilter)
    );
    const map = new Map<string, { key: string; name: string; rows: ConversionWithNames[] }>();
    for (const c of visible) {
      const key = c.caster_id ? String(c.caster_id) : "none";
      if (!map.has(key)) map.set(key, { key, name: c.caster_name || "No coater set", rows: [] });
      map.get(key)!.rows.push(c);
    }
    return Array.from(map.values())
      .map(g => ({ ...g, rows: g.rows.sort((a, b) => a.sent_date.localeCompare(b.sent_date) || a.id - b.id) }))
      .sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : a.name.localeCompare(b.name)));
  }, [conversions, statusFilter, vendorFilter]);

  const toggle = (id: number) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const statusBadge = (c: ConversionWithNames) => {
    if (c.status === "pending") return <Badge variant="outline">Not back yet</Badge>;
    if (c.status === "partial") return <Badge variant="secondary">Partly back</Badge>;
    return stillOut(c) > 0
      ? <Badge variant="destructive">Closed · {stillOut(c)} short</Badge>
      : <Badge>Complete</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="page-coating-conversions">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Coating Conversions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bare castings sent for coating and what has come back, by coater. Open a row to see its lots; a lot can be edited after it is received and its batch follows.
          </p>
        </div>
        {canMutate && (
          <Button onClick={() => setIsSendModalOpen(true)} data-testid="button-send-coating">
            <Plus className="h-4 w-4 mr-2" />
            Send for Coating
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border p-0.5" role="tablist">
          {([
            ["open", `Open (${openCount})`],
            ["closed", `Closed (${closedCount})`],
            ["all", `All (${conversions.length})`],
          ] as [StatusFilter, string][]).map(([v, label]) => (
            <Button
              key={v}
              size="sm"
              variant={statusFilter === v ? "default" : "ghost"}
              onClick={() => setStatusFilter(v)}
              data-testid={`filter-status-${v}`}
            >
              {label}
            </Button>
          ))}
        </div>
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-[220px]" data-testid="filter-vendor"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All coaters</SelectItem>
            {vendorOptions.map(([k, name]) => (
              <SelectItem key={k} value={k}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {statusFilter === "open" ? "Nothing is out for coating." : "No conversions to show."}
          </CardContent>
        </Card>
      )}

      {groups.map(g => {
        const out = g.rows.filter(isOpen).reduce((n, c) => n + stillOut(c), 0);
        return (
          <Card key={g.key} data-testid={`vendor-group-${g.key}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex flex-wrap items-baseline justify-between gap-2">
                <span>{g.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {g.rows.length} send{g.rows.length === 1 ? "" : "s"}
                  {out > 0 && <> · <strong className="text-foreground" data-testid={`vendor-out-${g.key}`}>{out} pcs still out</strong></>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Colour</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Back</TableHead>
                    <TableHead className="text-right">Still out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map(c => {
                    const isExpanded = expanded.has(c.id);
                    const out = stillOut(c);
                    return (
                      <Fragment key={c.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => toggle(c.id)}
                          data-testid={`row-conversion-${c.id}`}
                        >
                          <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(c.sent_date)}</TableCell>
                          <TableCell className="min-w-[140px]">
                            <div className="font-medium">{c.coated_item_name}</div>
                            <div className="text-xs text-muted-foreground">from {c.bare_item_name} · #{c.id}</div>
                          </TableCell>
                          <TableCell className="min-w-[90px]">{c.color || <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell className="text-right">{c.quantity_sent}</TableCell>
                          <TableCell className="text-right">{c.quantity_received ?? 0}</TableCell>
                          <TableCell className={`text-right font-medium ${out > 0 ? "" : "text-muted-foreground"}`} data-testid={`still-out-${c.id}`}>{out}</TableCell>
                          <TableCell>{statusBadge(c)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {canMutate && (
                              <div className="flex flex-wrap justify-end gap-1">
                                {c.status !== "received" && (
                                  <Button size="sm" onClick={() => setReceivingConversion(c)} data-testid={`button-receive-${c.id}`}>
                                    {c.status === "partial" ? "Receive lot" : "Receive"}
                                  </Button>
                                )}
                                {c.status === "partial" && (
                                  <Button size="sm" variant="outline" onClick={() => closeMutation.mutate({ id: c.id, action: "close" })} data-testid={`button-close-${c.id}`}>
                                    Close
                                  </Button>
                                )}
                                {c.status === "received" && out > 0 && (
                                  <Button size="sm" variant="outline" onClick={() => closeMutation.mutate({ id: c.id, action: "reopen" })} data-testid={`button-reopen-${c.id}`}>
                                    Reopen
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setEditingConversion(c)} aria-label="Edit send" data-testid={`button-edit-${c.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeletingConversion(c)} aria-label="Delete send" data-testid={`button-delete-${c.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30" data-testid={`lots-${c.id}`}>
                            <TableCell></TableCell>
                            <TableCell colSpan={8}>
                              {c.receipts.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-1">Nothing received yet.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Lot</TableHead>
                                      <TableHead>Received</TableHead>
                                      <TableHead className="text-right">Pcs back</TableHead>
                                      <TableHead className="text-right">QC rejects</TableHead>
                                      <TableHead className="text-right">Added to stock</TableHead>
                                      <TableHead>Batch</TableHead>
                                      <TableHead>Colour</TableHead>
                                      <TableHead className="text-right"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {c.receipts.map((r, i) => (
                                      <TableRow key={r.id} data-testid={`lot-${c.id}-${r.id}`}>
                                        <TableCell>{i + 1}</TableCell>
                                        <TableCell className="whitespace-nowrap">{formatDate(r.received_date)}</TableCell>
                                        <TableCell className="text-right">{r.quantity_received}</TableCell>
                                        <TableCell className="text-right">{r.quantity_rejected}</TableCell>
                                        <TableCell className="text-right">{r.quantity_received - r.quantity_rejected}</TableCell>
                                        <TableCell className="whitespace-nowrap">{r.batch_number || "-"}</TableCell>
                                        <TableCell>{r.color || "-"}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                          {canMutate && (
                                            <>
                                              <Button size="sm" variant="outline" onClick={() => setEditingLot({ conversion: c, lot: r })} data-testid={`button-edit-lot-${r.id}`}>
                                                Edit lot
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => undoLotMutation.mutate({ id: c.id, receiptId: r.id })} aria-label="Remove lot" data-testid={`button-undo-lot-${r.id}`}>
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                              {c.notes && <p className="text-xs text-muted-foreground mt-2">Note: {c.notes}</p>}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

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

      {editingLot && (
        <EditLotModal
          conversion={editingLot.conversion}
          lot={editingLot.lot}
          onClose={() => setEditingLot(null)}
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
          deletingConversion && deletingConversion.status !== "pending"
            ? "This will restore the bare stock sent and remove every coated lot it produced (only allowed if none of that coated stock has shipped yet; otherwise use Edit lot)."
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
  const outstanding = stillOut(conversion);
  const [quantityReceived, setQuantityReceived] = useState(outstanding.toString());
  const [quantityRejected, setQuantityRejected] = useState("0");
  const [finalTouched, setFinalTouched] = useState(false);
  const [isFinal, setIsFinal] = useState(true);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [color, setColor] = useState("");

  const receiveMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/coating-conversions/${conversion.id}/receive`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coating-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/stock-ledger") });
      toast({ title: isFinal ? "Received, send closed" : "Lot received, rest still out" });
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
    if (received <= 0) {
      toast({ title: "Quantity received must be more than 0", variant: "destructive" });
      return;
    }
    if (received > outstanding) {
      toast({ title: `Only ${outstanding} pcs are still out`, variant: "destructive" });
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
      is_final: isFinal,
    });
  };

  const receivedNum = parseInt(quantityReceived) || 0;
  const leftAfter = outstanding - receivedNum;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Coating — {conversion.coated_item_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sent {conversion.quantity_sent} pcs of {conversion.bare_item_name} on {formatDate(conversion.sent_date)}.
            {(conversion.quantity_received ?? 0) > 0 && ` ${conversion.quantity_received} already received in earlier lots.`}
            {" "}<strong>{outstanding} still out</strong> with the coater. Enter just this lot.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity Received</Label>
              <Input type="number" min="0" value={quantityReceived} onChange={(e) => {
                const v = e.target.value;
                setQuantityReceived(v);
                if (!finalTouched) setIsFinal((parseInt(v) || 0) >= outstanding);
              }} data-testid="input-quantity-received" />
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
          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox
              id="coating-final-lot"
              checked={isFinal}
              onCheckedChange={(v) => { setFinalTouched(true); setIsFinal(v === true); }}
              data-testid="checkbox-final-lot"
            />
            <label htmlFor="coating-final-lot" className="text-sm leading-snug">
              This is the last lot, close this send
              <span className="block text-xs text-muted-foreground">
                {isFinal
                  ? leftAfter > 0
                    ? `${leftAfter} pcs will be shown as not received.`
                    : "Everything sent has come back."
                  : `${Math.max(leftAfter, 0)} pcs stay out for coating until the next lot.`}
              </span>
            </label>
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


function EditLotModal({
  conversion,
  lot,
  onClose,
}: {
  conversion: ConversionWithNames;
  lot: ConversionWithNames["receipts"][number];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const otherLots = conversion.receipts.filter(r => r.id !== lot.id).reduce((n, r) => n + r.quantity_received, 0);
  const maxForLot = conversion.quantity_sent - otherLots;
  const [quantityReceived, setQuantityReceived] = useState(lot.quantity_received.toString());
  const [quantityRejected, setQuantityRejected] = useState(lot.quantity_rejected.toString());
  const [receivedDate, setReceivedDate] = useState(lot.received_date);
  const [color, setColor] = useState(lot.color || "");

  const mutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest("PATCH", `/api/coating-conversions/${conversion.id}/receipts/${lot.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coating-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/on-hand-stock"] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/stock-ledger") });
      toast({ title: "Lot updated, batch updated to match" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't update lot", description: error.message, variant: "destructive" });
    },
  });

  const received = parseInt(quantityReceived);
  const rejected = parseInt(quantityRejected);
  const good = (isNaN(received) ? 0 : received) - (isNaN(rejected) ? 0 : rejected);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(received) || received <= 0 || isNaN(rejected) || rejected < 0 || !receivedDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    if (rejected > received) {
      toast({ title: "Rejected can't exceed received", variant: "destructive" });
      return;
    }
    if (received > maxForLot) {
      toast({ title: `This lot can be at most ${maxForLot} pcs`, variant: "destructive" });
      return;
    }
    mutation.mutate({ quantity_received: received, quantity_rejected: rejected, received_date: receivedDate, color: color || null });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="dialog-edit-lot">
        <DialogHeader>
          <DialogTitle>Edit lot — {conversion.coated_item_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sent {conversion.quantity_sent} pcs on {formatDate(conversion.sent_date)}. This lot is in batch <strong>{lot.batch_number || "-"}</strong>;
            changes here update that batch. Pieces already shipped from it stay shipped.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity Received</Label>
              <Input type="number" min="1" max={maxForLot} value={quantityReceived} onChange={(e) => setQuantityReceived(e.target.value)} data-testid="input-edit-lot-received" />
            </div>
            <div>
              <Label>Rejected at Our QC</Label>
              <Input type="number" min="0" value={quantityRejected} onChange={(e) => setQuantityRejected(e.target.value)} data-testid="input-edit-lot-rejected" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Received Date</Label>
              <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} data-testid="input-edit-lot-date" />
            </div>
            <div>
              <Label>Colour</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black, Ivory" data-testid="input-edit-lot-color" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Adds <strong>{good}</strong> pcs to stock (was {lot.quantity_received - lot.quantity_rejected}). Up to {maxForLot} pcs allowed for this lot.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-lot">
              {mutation.isPending ? "Saving..." : "Save lot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
