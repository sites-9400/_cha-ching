import type { Channel, LineStatus } from "./types";

export type LineSortKey = "order" | "amount" | "channel" | "name" | "paid";

interface Sortable { name: string; amount: number; channel: Channel; order: number; status: LineStatus }

/** Comparators for sorting expense lines within a cutoff. Pure. */
export const lineComparators: Record<LineSortKey, (a: Sortable, b: Sortable) => number> = {
  order: (a, b) => a.order - b.order,
  amount: (a, b) => b.amount - a.amount, // biggest first
  channel: (a, b) => String(a.channel).localeCompare(String(b.channel)) || (a.order - b.order),
  name: (a, b) => a.name.localeCompare(b.name),
  paid: (a, b) => Number(b.status !== "") - Number(a.status !== "") || (a.order - b.order),
};

export const LINE_SORTS: { key: LineSortKey; label: string }[] = [
  { key: "order", label: "Default" },
  { key: "amount", label: "Amount" },
  { key: "channel", label: "Channel" },
  { key: "name", label: "Name" },
  { key: "paid", label: "Paid first" },
];

/** Parse a persisted sort key; anything unknown falls back to "order". */
export function parseLineSortKey(raw: string | null): LineSortKey {
  return LINE_SORTS.some((s) => s.key === raw) ? (raw as LineSortKey) : "order";
}
