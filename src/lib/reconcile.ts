import type { MonthLine, TemplateLine } from "./types";

/**
 * Diff the template against a month's lines. Template-derived lines (oneOff:false)
 * are upserted from the template but KEEP status/paidDate; missing templates are
 * added blank; removed templates are deleted. oneOff lines are never touched. Pure.
 */
export function reconcileLines(
  template: TemplateLine[],
  monthLines: MonthLine[],
): { upserts: MonthLine[]; deletes: string[] } {
  const byId = new Map(monthLines.map((l) => [l.id, l]));
  const templateIds = new Set(template.map((t) => t.id));

  const upserts: MonthLine[] = template.map((t) => {
    const existing = byId.get(t.id);
    return {
      id: t.id, name: t.name, amount: t.amount, channel: t.channel, cutoff: t.cutoff,
      order: t.order, oneOff: false,
      status: existing?.status ?? "",
      ...(existing?.paidDate ? { paidDate: existing.paidDate } : {}),
    };
  });

  const deletes = monthLines
    .filter((l) => !l.oneOff && !templateIds.has(l.id))
    .map((l) => l.id);

  return { upserts, deletes };
}
