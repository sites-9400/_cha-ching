import { LINE_GROUPS, groupLabel, resolveGroup } from "./lineGroups";
import type { LineGroup, MonthLine } from "./types";

export interface OutflowGroup { key: LineGroup; label: string; amount: number; count: number }

/** Groups one cutoff's outgoing lines into ranked groups. Pure and
 *  deterministic: sorted by amount desc (ties keep LINE_GROUPS order),
 *  empty (zero-amount) groups dropped. Lines passed in are already active. */
export function groupOutflow(lines: MonthLine[], cutoff: 1 | 2): OutflowGroup[] {
  const acc = new Map<LineGroup, { amount: number; count: number }>();
  for (const l of lines) {
    if (l.cutoff !== cutoff) continue;
    const k = resolveGroup(l);
    const cur = acc.get(k) ?? { amount: 0, count: 0 };
    cur.amount += l.amount;
    cur.count += 1;
    acc.set(k, cur);
  }
  return LINE_GROUPS
    .map((g, i) => ({ key: g.key, label: groupLabel(g.key), amount: acc.get(g.key)?.amount ?? 0, count: acc.get(g.key)?.count ?? 0, i }))
    .filter((g) => g.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.i - b.i)
    .map(({ key, label, amount, count }) => ({ key, label, amount, count }));
}
