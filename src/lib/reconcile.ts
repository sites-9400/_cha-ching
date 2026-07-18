import type { MonthLine, TemplateLine } from "./types";

/**
 * Diff the template against a month's lines. Template-derived lines (oneOff:false)
 * are upserted from the template but KEEP status/paidDate; missing templates are
 * added blank; removed templates are deleted. oneOff lines are never touched.
 *
 * If a template line's id has no month-line match (e.g. the line was re-created with
 * a new id), it falls back to matching an untracked non-oneOff month line by
 * (name, cutoff) so the tick MIGRATES to the new id instead of being wiped — the
 * old-id doc is then deleted. Cutoffs in `closedCutoffs` are frozen — no
 * upserts into them, no moves out of them, no deletes within them. Pure.
 */
export function reconcileLines(
  template: TemplateLine[],
  monthLines: MonthLine[],
  closedCutoffs: ReadonlySet<number> = new Set(),
): { upserts: MonthLine[]; deletes: string[] } {
  const byId = new Map(monthLines.map((l) => [l.id, l]));
  const templateIds = new Set(template.map((t) => t.id));
  const consumed = new Set<string>(); // month-line ids matched by a template line

  const upserts: MonthLine[] = [];
  for (const t of template) {
    const direct = byId.get(t.id);
    // Closed cutoffs are frozen: never insert into one, never move a line out of one.
    if (closedCutoffs.has(t.cutoff) || (direct && closedCutoffs.has(direct.cutoff))) {
      if (direct) consumed.add(direct.id);
      continue;
    }
    if (direct?.overridden) { consumed.add(direct.id); continue; } // leave inline-edits untouched

    let existing = direct;
    if (!existing) {
      // Fallback: an untracked, non-oneOff, non-overridden month line with the same
      // name + cutoff — a line whose id diverged from the template's.
      existing = monthLines.find(
        (l) => !l.oneOff && !l.overridden && !consumed.has(l.id) && !templateIds.has(l.id)
          && l.name === t.name && l.cutoff === t.cutoff,
      );
    }
    if (existing) consumed.add(existing.id);

    upserts.push({
      id: t.id, name: t.name, amount: t.amount, channel: t.channel, cutoff: t.cutoff,
      order: t.order, oneOff: false,
      status: existing?.status ?? "",
      ...(t.debtId ? { debtId: t.debtId } : {}),
      ...(t.isEnvelope ? { isEnvelope: true } : {}),
      ...(existing?.paidDate ? { paidDate: existing.paidDate } : {}),
    });
  }

  // Delete any non-oneOff, non-overridden month line whose id isn't a current template
  // id: either a removed template, or a fallback-migrated old-id doc.
  const deletes = monthLines
    .filter((l) => !l.oneOff && !l.overridden && !templateIds.has(l.id) && !closedCutoffs.has(l.cutoff))
    .map((l) => l.id);

  return { upserts, deletes };
}
