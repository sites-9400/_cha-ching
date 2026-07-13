import type { Channel, Debt } from "./types";

export type AllocKind = "minimum" | "target" | "spill";

export interface AllocLine {
  debtId: string;
  name: string;
  amount: number;
  kind: AllocKind;
  channel: Channel;
  minIncluded?: number;
}

export interface Allocation {
  lines: AllocLine[];
  shortfall: number;
}

/** Due-day → cutoff: 13–24 → 1; 25–31 or 1–12 → 2; unset → 2 (later, safer). */
export function cutoffForDueDay(dueDay: number | undefined): 1 | 2 {
  if (dueDay === undefined) return 2;
  return dueDay >= 13 && dueDay <= 24 ? 1 : 2;
}

/**
 * Allocate a cutoff's free cash across debts by avalanche:
 * reserve non-target minimums assigned to this cutoff, then waterfall the rest
 * down the payoff order. Exactly one merged line per debt. Pure — no Firestore.
 */
export function allocateCutoff(freeCash: number, debts: Debt[], cutoff: 1 | 2): Allocation {
  const cands = debts
    .filter((d) => d.active && !d.isBNPL && d.currentBalance > 0)
    .sort((a, b) => a.payoffOrder - b.payoffOrder);
  const target = cands[0]; // lowest payoffOrder, or undefined if none

  const acc = new Map<string, { min: number; water: number }>();
  const bucket = (id: string) => {
    let b = acc.get(id);
    if (!b) { b = { min: 0, water: 0 }; acc.set(id, b); }
    return b;
  };

  let remaining = freeCash;
  let requiredMin = 0;

  // Minimums pass: non-target debts assigned to this cutoff, with a positive minimum.
  for (const d of cands) {
    if (target && d.id === target.id) continue;
    if (cutoffForDueDay(d.dueDay) !== cutoff) continue;
    const min = d.minimum ?? 0;
    if (min <= 0) continue;
    requiredMin += Math.min(min, d.currentBalance);
    const reserve = Math.min(min, d.currentBalance, Math.max(0, remaining));
    if (reserve <= 0) continue;
    bucket(d.id).min += reserve;
    remaining -= reserve;
  }

  const shortfall = Math.max(0, requiredMin - freeCash);

  // Waterfall pass: send everything left down the payoff order, capped by balance.
  for (const d of cands) {
    if (remaining <= 0) break;
    const b = bucket(d.id);
    const capacity = d.currentBalance - b.min;
    if (capacity <= 0) continue;
    const pay = Math.min(capacity, remaining);
    b.water += pay;
    remaining -= pay;
  }

  // Merge → one line per debt that received money, in payoff order.
  const lines: AllocLine[] = [];
  for (const d of cands) {
    const b = acc.get(d.id);
    if (!b) continue;
    const amount = b.min + b.water;
    if (amount <= 0) continue;
    const isTarget = !!target && d.id === target.id;
    const kind: AllocKind = isTarget ? "target" : b.water > 0 ? "spill" : "minimum";
    const line: AllocLine = { debtId: d.id, name: d.name, amount, kind, channel: d.channel };
    if (b.min > 0 && b.water > 0) line.minIncluded = b.min;
    lines.push(line);
  }

  return { lines, shortfall };
}
