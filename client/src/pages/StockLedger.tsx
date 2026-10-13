import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

type MovementType = "purchase" | "coating_return" | "rework_replacement" | "sale" | "kit_component" | "coating_send";

interface Movement {
  id: string;
  type: MovementType;
  direction: "in" | "out";
  date: string;
  vendor_id: number | null;
  vendor_name: string;
  item_id: number;
  quantity: number;
  reference: string;
  party: string;
  note: string;
}

interface LedgerRow {
  key: string;
  item_id: number;
  item_name: string;
  sku: string;
  size_specification: string;
  finish: string | null;
  opening: number;
  months: Record<string, { in: number; out: number; closing: number }>;
}

interface InTransitRow {
  key: string;
  vendor_name: string;
  bare_item_name: string;
  coated_item_name: string;
  months: Record<string, { quantity: number; conversions: Array<{ id: number; sent_date: string; quantity: number; color: string | null }> }>;
}

interface Mismatch {
  batch_number: string;
  item_name: string;
  vendor_name: string;
  produced: number;
  taken_out: number;
  expected_remaining: number;
  system_remaining: number;
  difference: number;
}

interface LedgerData {
  months: string[];
  rows: LedgerRow[];
  in_transit: InTransitRow[];
  movements: Movement[];
  mismatches: Mismatch[];
  earliest_month: string | null;
}

const TYPE_LABEL: Record<MovementType, string> = {
  purchase: "Received from vendor",
  coating_return: "Back from coating",
  rework_replacement: "Rework replacement",
  sale: "Sale",
  kit_component: "Used in kit",
  coating_send: "Sent for coating",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const lastDayLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${new Date(Date.UTC(y, mo, 0)).getUTCDate()} ${MONTH_NAMES[mo - 1]}`;
};
// The date a month's closing figure is "as at". A month that hasn't ended yet
// shows today's date instead, so it never claims a future date like 31 Oct.
const asAt = (m: string) => {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, mo] = m.split("-").map(Number);
  if (m === thisMonth) return { text: `${now.getDate()} ${MONTH_NAMES[mo - 1]} ${y}`, live: true };
  return { text: `${lastDayLabel(m)} ${y}`, live: false };
};
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[Number(mo) - 1]} ${y}`;
};

interface Selection {
  row: LedgerRow;
  /** null = the "before the first month" opening balance */
  month: string | null;
}

export default function StockLedger() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);

  const { data, isLoading, error } = useQuery<LedgerData>({
    queryKey: [`/api/stock-ledger?from=${from}&to=${to}`],
  });

  const months = data?.months ?? [];
  const shownFrom = from || months[0] || "";
  const shownTo = to || months[months.length - 1] || "";

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => !q || `${r.item_name} ${r.sku} ${r.size_specification}`.toLowerCase().includes(q));
  }, [data, search]);

  // Bare / Non-stick / Ceramic, each with its own total
  const finishGroups = useMemo(() => {
    const order = ["Bare (no coating)", "Non-stick (NS)", "Ceramic (CER)", "Other"];
    const bucket = (finish: string | null) =>
      !finish || finish === "bare" ? order[0] : finish === "nonstick" ? order[1] : finish === "ceramic" ? order[2] : order[3];
    return order
      .map((label) => ({ label, rows: visibleRows.filter((r) => bucket(r.finish) === label) }))
      .filter((g) => g.rows.length > 0);
  }, [visibleRows]);

  return (
    <div className="space-y-4" data-testid="page-stock-ledger">
      <div>
        <h1 className="text-2xl font-semibold">Stock Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Closing stock for every SKU as at the last day of each month (today's date for the current month), rebuilt from batches
          received, shipments, kit use and coating sends. Hover a number for the quick maths; click it to see who it was
          received from and who it went to.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="ledger-from">From month</Label>
          <Input id="ledger-from" type="month" value={shownFrom} onChange={(e) => setFrom(e.target.value)} className="w-40" data-testid="input-ledger-from" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ledger-to">To month</Label>
          <Input id="ledger-to" type="month" value={shownTo} onChange={(e) => setTo(e.target.value)} className="w-40" data-testid="input-ledger-to" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ledger-search">Item</Label>
          <Input id="ledger-search" placeholder="Search item or SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" data-testid="input-ledger-search" />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load the ledger</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {data && data.mismatches.length > 0 && (
        <Alert data-testid="ledger-mismatch-alert">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{data.mismatches.length} batch{data.mismatches.length === 1 ? "" : "es"} don't tie up with the Batches page</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              For these batches, what was received minus what the records show going out doesn't equal the quantity left on
              the Batches page — usually a manual stock edit or an adjustment. The ledger above uses the records, so its
              totals will differ from Batches by the amounts below.
            </p>
            <div className="border rounded-md bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Went out</TableHead>
                    <TableHead className="text-right">Ledger says left</TableHead>
                    <TableHead className="text-right">Batches page says</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.mismatches.map((m) => (
                    <TableRow key={m.batch_number}>
                      <TableCell>{m.batch_number}</TableCell>
                      <TableCell>{m.item_name}</TableCell>
                      <TableCell>{m.vendor_name}</TableCell>
                      <TableCell className="text-right">{m.produced}</TableCell>
                      <TableCell className="text-right">{m.taken_out}</TableCell>
                      <TableCell className="text-right">{m.expected_remaining}</TableCell>
                      <TableCell className="text-right">{m.system_remaining}</TableCell>
                      <TableCell className="text-right font-medium">{m.difference > 0 ? `+${m.difference}` : m.difference}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading...</p>
          ) : visibleRows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No stock movements in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56 sticky left-0 bg-background z-10">Item</TableHead>
                  <TableHead className="text-right">
                    <div>Opening</div>
                    <div className="text-[11px] font-normal">before 1 {months[0] ? monthLabel(months[0]).split(" ")[0] : ""}</div>
                  </TableHead>
                  {months.map((m) => (
                    <TableHead key={m} className="text-right whitespace-nowrap">
                      <div>{asAt(m).text}</div>
                      <div className="text-[11px] font-normal">{asAt(m).live ? "today (month not over)" : "closing stock"}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {finishGroups.map((g) => (
                  <Fragment key={g.label}>
                    <TableRow className="bg-muted/50" data-testid="ledger-group">
                      <TableCell className="font-semibold sticky left-0 bg-muted/50 z-10">{g.label}</TableCell>
                      <TableCell className="text-right font-medium">{g.rows.reduce((t, r) => t + r.opening, 0)}</TableCell>
                      {months.map((m) => (
                        <TableCell key={m} className="text-right font-medium">
                          {g.rows.reduce((t, r) => t + r.months[m].closing, 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {g.rows.map((r) => (
                      <ItemRow key={r.key} r={r} months={months} onPick={setSelection} />
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Closing = opening + received − sold − used in kits − sent for coating, counted once each. "Opening" is everything before{" "}
        {shownFrom ? monthLabel(shownFrom) : "the first month"}. Pieces sent for coating leave the bare item's stock when
        sent, and are added to the coated item's stock when they come back.
      </p>

      {data && data.in_transit.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sent for coating, not back yet (at month end)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coating vendor</TableHead>
                  <TableHead>Sent as → comes back as</TableHead>
                  {months.map((m) => (
                    <TableHead key={m} className="text-right whitespace-nowrap">
                      {monthLabel(m)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.in_transit.map((t) => (
                  <TableRow key={t.key}>
                    <TableCell>{t.vendor_name}</TableCell>
                    <TableCell>
                      {t.bare_item_name} → {t.coated_item_name}
                    </TableCell>
                    {months.map((m) => {
                      const cell = t.months[m];
                      return (
                        <TableCell key={m} className="text-right">
                          {cell.quantity ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">{cell.quantity}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {cell.conversions.map((c) => (
                                  <div key={c.id}>
                                    Coating #{c.id}: {c.quantity} sent {formatDate(c.sent_date)}
                                    {c.color ? ` (${c.color})` : ""}
                                  </div>
                                ))}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <MovementDialog
        selection={selection}
        movements={data?.movements ?? []}
        firstMonth={months[0]}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}

function ItemRow({ r, months, onPick }: { r: LedgerRow; months: string[]; onPick: (s: Selection) => void }) {
  return (
    <TableRow data-testid={`ledger-row-${r.key}`}>
      <TableCell className="sticky left-0 bg-background z-10">
        <div className="font-medium">{r.item_name}</div>
        <div className="text-xs text-muted-foreground">
          {r.sku}
          {r.size_specification ? ` · ${r.size_specification}` : ""}
          {r.finish && r.finish !== "bare" ? ` · ${r.finish}` : ""}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <NumberCell
          value={r.opening}
          tip="Everything received minus everything gone out before the first month shown"
          onClick={() => onPick({ row: r, month: null })}
        />
      </TableCell>
      {months.map((m, i) => {
        const cell = r.months[m];
        const prev = i === 0 ? r.opening : r.months[months[i - 1]].closing;
        return (
          <TableCell key={m} className="text-right">
            <NumberCell
              value={cell.closing}
              sub={cell.in || cell.out ? `${cell.in ? `+${cell.in}` : ""}${cell.in && cell.out ? " " : ""}${cell.out ? `−${cell.out}` : ""}` : undefined}
              tip={`${monthLabel(m)}: opening ${prev}, received ${cell.in}, went out ${cell.out} → closing ${cell.closing} as at ${asAt(m).text}. Click to see who from / who to.`}
              onClick={() => onPick({ row: r, month: m })}
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function NumberCell({ value, sub, tip, onClick }: { value: number; sub?: string; tip: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={`text-right rounded px-2 py-1 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value < 0 ? "text-destructive" : ""}`}
          data-testid="ledger-cell"
        >
          <div className="font-medium tabular-nums">{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground tabular-nums">{sub}</div>}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

function MovementDialog({
  selection,
  movements,
  firstMonth,
  onClose,
}: {
  selection: Selection | null;
  movements: Movement[];
  firstMonth: string | undefined;
  onClose: () => void;
}) {
  const [showEarlier, setShowEarlier] = useState(false);

  const view = useMemo(() => {
    if (!selection) return null;
    const { row, month } = selection;
    const mine = movements.filter((m) => m.item_id === row.item_id);
    const cutoffMonth = month ?? firstMonth ?? "9999-99";
    const earlier = mine.filter((m) => m.date.slice(0, 7) < (month ?? cutoffMonth));
    const thisMonth = month ? mine.filter((m) => m.date.slice(0, 7) === month) : [];
    const sum = (list: Movement[]) => list.reduce((s, m) => s + (m.direction === "in" ? m.quantity : -m.quantity), 0);
    const opening = month ? sum(earlier) : 0;
    return { earlier, thisMonth, opening, closing: month ? opening + sum(thisMonth) : sum(earlier) };
  }, [selection, movements, firstMonth]);

  const close = (open: boolean) => {
    if (!open) {
      setShowEarlier(false);
      onClose();
    }
  };

  const list = selection?.month ? view?.thisMonth : view?.earlier;

  return (
    <Dialog open={!!selection} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ledger-movements">
        {selection && view && (
          <>
            <DialogHeader>
              <DialogTitle>
                {selection.row.item_name} <span className="text-muted-foreground font-normal text-base">{selection.row.sku}</span>
              </DialogTitle>
              <DialogDescription>
                {selection.month
                  ? `Closing stock as at ${asAt(selection.month).text}${asAt(selection.month).live ? " (today, month not over)" : ""}`
                  : `Stock carried in from before ${firstMonth ? monthLabel(firstMonth) : "the first month"}`}
              </DialogDescription>
            </DialogHeader>

            {selection.month ? (
              <div className="grid grid-cols-4 gap-2 text-center" data-testid="ledger-equation">
                <Stat label="Opening" value={view.opening} />
                <Stat label="Received" value={view.thisMonth.filter((m) => m.direction === "in").reduce((s, m) => s + m.quantity, 0)} sign="+" />
                <Stat label="Went out" value={view.thisMonth.filter((m) => m.direction === "out").reduce((s, m) => s + m.quantity, 0)} sign="−" />
                <Stat label="Closing" value={view.closing} strong />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 text-center">
                <Stat label="Opening balance" value={view.closing} strong />
              </div>
            )}

            <PartySummary list={list ?? []} />

            <MovementTable list={list ?? []} empty={selection.month ? "Nothing moved this month." : "Nothing before this period."} />

            {selection.month && view.earlier.length > 0 && (
              <div>
                <button
                  type="button"
                  className="text-sm text-primary underline"
                  onClick={() => setShowEarlier((v) => !v)}
                >
                  {showEarlier ? "Hide" : "Show"} the {view.earlier.length} earlier movement{view.earlier.length === 1 ? "" : "s"} that make up the opening of {view.opening}
                </button>
                {showEarlier && (
                  <div className="mt-2">
                    <MovementTable list={view.earlier} empty="" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const PARTY_VERB: Record<MovementType, string> = {
  purchase: "Received from",
  coating_return: "Received back from",
  rework_replacement: "Replacement received from",
  sale: "Sold to",
  kit_component: "Used in kits shipped to",
  coating_send: "Sent for coating to",
};

function PartySummary({ list }: { list: Movement[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { type: MovementType; label: string; total: number; direction: "in" | "out" }>();
    list.forEach((m) => {
      // Who it came from / went to: the vendor for stock in, the customer or coating vendor for stock out
      const who = m.type === "coating_send" ? m.party.replace(/^Coating at /, "") : m.type === "coating_return" ? m.vendor_name : m.party || m.vendor_name;
      const key = `${m.type}|${who}`;
      const g = map.get(key) ?? { type: m.type, label: `${PARTY_VERB[m.type]} ${who}`, total: 0, direction: m.direction };
      g.total += m.quantity;
      map.set(key, g);
    });
    return Array.from(map.values()).sort((a, b) => (a.direction === b.direction ? b.total - a.total : a.direction === "in" ? -1 : 1));
  }, [list]);
  if (groups.length === 0) return null;
  return (
    <div className="border rounded-md" data-testid="ledger-party-summary">
      <Table>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={`${g.type}-${g.label}`}>
              <TableCell>{g.label}</TableCell>
              <TableCell className={`text-right font-medium tabular-nums ${g.direction === "in" ? "" : "text-destructive"}`}>
                {g.direction === "in" ? "+" : "−"}
                {g.total}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Stat({ label, value, sign, strong }: { label: string; value: number; sign?: string; strong?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${strong ? "bg-muted" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">
        {sign ?? ""}
        {value}
      </div>
    </div>
  );
}

function MovementTable({ list, empty }: { list: Movement[]; empty: string }) {
  if (list.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>What</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Party / details</TableHead>
            <TableHead className="text-right">Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="whitespace-nowrap">{formatDate(m.date)}</TableCell>
              <TableCell>
                <Badge variant={m.direction === "in" ? "secondary" : "outline"}>{TYPE_LABEL[m.type]}</Badge>
              </TableCell>
              <TableCell>{m.reference}</TableCell>
              <TableCell>
                <div>{m.party}</div>
                {m.note && <div className="text-xs text-muted-foreground">{m.note}</div>}
              </TableCell>
              <TableCell className={`text-right font-medium tabular-nums ${m.direction === "in" ? "" : "text-destructive"}`}>
                {m.direction === "in" ? "+" : "−"}
                {m.quantity}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
