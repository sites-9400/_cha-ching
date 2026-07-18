import { allocateCutoff, type Allocation } from "./allocate";
import type { Debt } from "./types";

/** Debt payments already made in a given month + cutoff, summed per debt. Pure. */
export function paidByDebt(
  payments: readonly { debtId: string; monthKey: string; cutoff: 1 | 2; amount: number }[],
  monthKey: string,
  cutoff: 1 | 2,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of payments) {
    if (p.monthKey === monthKey && p.cutoff === cutoff) {
      m.set(p.debtId, (m.get(p.debtId) ?? 0) + p.amount);
    }
  }
  return m;
}

/**
 * The cutoff's debt allocation on start-of-cutoff balances: restore what this
 * cutoff's payments already cleared so a completed payment ticks off instead of
 * spilling onto the next debt. Shared by the debt plan and the send calculator. Pure.
 */
export function cutoffAllocation(
  freeCash: number,
  debts: Debt[],
  paid: Map<string, number>,
  cutoff: 1 | 2,
  cycleMins?: ReadonlyMap<string, number>,
): Allocation {
  const planDebts = debts.map((d) =>
    paid.has(d.id) ? { ...d, currentBalance: d.currentBalance + (paid.get(d.id) ?? 0) } : d,
  );
  return allocateCutoff(freeCash, planDebts, cutoff, cycleMins);
}

export interface ChannelSend { channel: string; total: number }

/**
 * How much to send to each channel for a cutoff = its expense lines + the given debt
 * allocation routed through that channel. "remaining" skips ticked expense lines
 * ("full" counts them all); the caller passes the mode-appropriate `alloc` (remaining
 * cash on live balances vs the full allocation). The `incomeChannel` (where salary
 * lands) is excluded — that money is already there. Sorted desc, zeros omitted. Pure.
 */
export function fundingByChannel(
  lines: readonly { channel: string; amount: number; status: string }[],
  alloc: readonly { channel: string; amount: number }[],
  mode: "remaining" | "full",
  incomeChannel?: string,
): ChannelSend[] {
  const byChannel = new Map<string, number>();
  const add = (ch: string, amt: number) => {
    if (incomeChannel && ch === incomeChannel) return; // already in the income account
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + amt);
  };

  for (const l of lines) {
    if (mode === "remaining" && l.status !== "") continue;
    add(String(l.channel), l.amount);
  }
  for (const a of alloc) add(String(a.channel), a.amount);

  return [...byChannel.entries()]
    .map(([channel, total]) => ({ channel, total }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}
