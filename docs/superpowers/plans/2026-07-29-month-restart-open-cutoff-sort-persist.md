# Month Restart + Open-Cutoff Launch + Persistent Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Restart month" action that regenerates the month from the template and rolls back tick bookkeeping; closed cutoffs collapse on load so the open cutoff is on top; the line-sort choice persists.

**Architecture:** `restartMonth` in repo.ts composes existing pieces (backupMonth, generateMonthLines, the doc-driven reversal patterns from `skipLineForMonth`/`setIncomeReceived`). Collapse is local view state in ThisMonth initialized from `isCutoffClosed`. Sort persistence mirrors Quick Add's localStorage pattern via a validated parser in lineSort.ts.

**Tech Stack:** React + TypeScript + Firebase Firestore (writeBatch/increment), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-29-month-restart-open-cutoff-sort-persist-design.md`

## Global Constraints

- **Do NOT run any commands** — no npm, npx, vitest, tsc, node, or git. The repo is on a Dropbox mount where tooling hangs. Write code and tests only; the orchestrator verifies and commits.
- Match existing style: 2-space indent, double quotes, semicolons, `type`-only imports where the file already uses them.
- Do not touch `src/lib/monthExport.ts`, `src/index.css`, or `MonthProvider.tsx`.

---

### Task 1: `parseLineSortKey` + persistence helper

**Files:**
- Modify: `src/lib/lineSort.ts` (append at end)
- Test: `src/lib/lineSort.test.ts` (append a describe block)

**Interfaces:**
- Produces: `parseLineSortKey(raw: string | null): LineSortKey` — Task 3 uses it to read localStorage.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/lineSort.test.ts`:

```ts
describe("parseLineSortKey", () => {
  it("passes through every known key", () => {
    for (const s of LINE_SORTS) expect(parseLineSortKey(s.key)).toBe(s.key);
  });

  it("falls back to order for garbage or null", () => {
    expect(parseLineSortKey("bogus")).toBe("order");
    expect(parseLineSortKey(null)).toBe("order");
    expect(parseLineSortKey("")).toBe("order");
  });
});
```

Add `parseLineSortKey` to the existing import from `./lineSort`.

- [ ] **Step 2: Implement**

Append to `src/lib/lineSort.ts`:

```ts
/** Parse a persisted sort key; anything unknown falls back to "order". */
export function parseLineSortKey(raw: string | null): LineSortKey {
  return LINE_SORTS.some((s) => s.key === raw) ? (raw as LineSortKey) : "order";
}
```

---

### Task 2: `restartMonth` in the repo layer

**Files:**
- Modify: `src/lib/repo.ts` (append after `startMonth`, which ends at line 518)

**Interfaces:**
- Consumes: `backupMonth`, `generateMonthLines`, and the existing imports `templateLines`, `eventsCol`, `monthLines`, `monthIncomes`, `monthDoc`, `debtsCol`, `debtPayments`, `savingsMovesCol`, `metaDoc` (all already imported in repo.ts — verify, add any missing to the existing import lists).
- Produces: `restartMonth(monthKey: string): Promise<void>` — Task 4's UI calls it.

No unit tests (repo layer has no test seams; the orchestrator reviews against the tested `skipLineForMonth`/`setIncomeReceived` reversal patterns).

- [ ] **Step 1: Implement**

```ts
/** Regenerate a month fresh from the template + events. Tick-created
 *  bookkeeping is reversed doc-by-doc first — line payments (monthKey +
 *  lineId) restore their debt's balance, income savings moves (monthKey +
 *  incomeId) restore the savings balance — so re-ticking the restarted month
 *  records everything correctly. Expenses stay: they are real spending, not
 *  tick bookkeeping. backupMonth snapshots the old state first. */
export async function restartMonth(monthKey: string): Promise<void> {
  await backupMonth(monthKey, "month restart");
  const [tSnap, eSnap, lSnap, iSnap, dSnap, sSnap] = await Promise.all([
    getDocs(collection(db, templateLines())),
    getDocs(collection(db, eventsCol())),
    getDocs(collection(db, monthLines(monthKey))),
    getDocs(collection(db, monthIncomes(monthKey))),
    getDocs(collection(db, debtsCol())),
    getDocs(collection(db, savingsMovesCol())),
  ]);
  const template = tSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TemplateLine[];
  const events = eSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as EventItem[];

  const batch = writeBatch(db);
  // Reverse line-generated debt payments (Debt Plan extras carry no lineId).
  for (const debt of dSnap.docs) {
    const pSnap = await getDocs(collection(db, debtPayments(debt.id)));
    for (const p of pSnap.docs) {
      const data = p.data();
      if (data.monthKey === monthKey && data.lineId) {
        batch.delete(p.ref);
        batch.update(doc(db, debtsCol(), debt.id), { currentBalance: increment(data.amount as number) });
      }
    }
  }
  // Reverse income-tick savings moves (manual deposits/corrections carry no incomeId).
  for (const m of sSnap.docs) {
    const data = m.data();
    if (data.monthKey === monthKey && data.incomeId) {
      batch.delete(m.ref);
      batch.update(doc(db, metaDoc()), { savingsBalance: increment(-(data.amount as number)) });
    }
  }
  for (const d of lSnap.docs) batch.delete(d.ref);
  for (const d of iSnap.docs) batch.delete(d.ref);
  for (const l of generateMonthLines(template, events, monthKey)) {
    batch.set(doc(db, monthLines(monthKey), l.id), l);
  }
  batch.set(doc(db, monthDoc(monthKey)), { startedAt: new Date().toISOString(), receivedIncomes: {} });
  await batch.commit();
}
```

Note: the meta `batch.set` is a deliberate full overwrite (fresh `startedAt`, cleared `receivedIncomes`); the `incomes` snapshot `writeMonth` writes is unused by the UI, matching the spec. Line docs are written with `l` whole (id included), matching `writeMonth`'s existing behavior at repo.ts:116.

---

### Task 3: ThisMonth — persistent sort + collapsed closed cutoffs + Restart action

**Files:**
- Modify: `src/components/ThisMonth.tsx`

**Interfaces:**
- Consumes: `parseLineSortKey` (Task 1), `restartMonth` (Task 2), existing `isCutoffClosed`, `ConfirmDialog`, `monthLabel`.

- [ ] **Step 1: Imports and state**

Add `useEffect` to the react import (line 1) and extend the lineSort/repo imports:

```ts
import { useEffect, useState } from "react";
import { lineComparators, LINE_SORTS, parseLineSortKey, type LineSortKey } from "../lib/lineSort";
import { deleteMonthIncome, deleteMonthLine, deleteTemplateLine, restartMonth, setIncomeReceived, skipLineForMonth, syncMonthFromTemplate, toggleLinePaid, unskipLine } from "../lib/repo";
```

Replace the `lineSort` state (line 41) and add collapse + restart state below the existing state block (lines 39-42):

```ts
  const [lineSort, setLineSortState] = useState<LineSortKey>(() => parseLineSortKey(localStorage.getItem("month-line-sort")));
  const setLineSort = (k: LineSortKey) => {
    setLineSortState(k);
    localStorage.setItem("month-line-sort", k);
  };
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Closed cutoffs start collapsed so the open cutoff sits on top. Initialized
  // on load / month change only — ticking a cutoff closed mid-session must not
  // snap it shut. null = not yet initialized (render falls back to live state).
  const [collapsed, setCollapsed] = useState<Record<1 | 2, boolean> | null>(null);
  useEffect(() => {
    if (!ready) return;
    setCollapsed({ 1: isCutoffClosed(lines, 1), 2: isCutoffClosed(lines, 2) });
    // Re-init on month change only — `lines` deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, viewedKey]);
  const toggleCutoff = (c: 1 | 2) => setCollapsed((prev) => {
    const base = prev ?? { 1: isCutoffClosed(lines, 1), 2: isCutoffClosed(lines, 2) };
    return { ...base, [c]: !base[c] };
  });
```

The sort chip row (lines 108-119) needs no changes — `setLineSort` keeps its name.

- [ ] **Step 2: Restart button**

In the `editable` action row, after the "Sync from template" button (line 102), add as a sibling inside the same flex div:

```tsx
            <button onClick={() => setConfirmRestart(true)} className="font-semibold text-red-600">Restart month</button>
```

Place it inside the `{editable && ...}` block but OUTSIDE the `{mode === "current" && ...}` guard (restart works for started-early months too).

- [ ] **Step 3: Collapsed section rendering**

Inside the `([1, 2] as const).map` callback, after `const closed = isCutoffClosed(lines, cutoff);` (line 131), add:

```tsx
        const isCollapsed = collapsed ? collapsed[cutoff] : closed;

        if (isCollapsed) {
          return (
            <section key={cutoff} className="mb-6">
              <button
                onClick={() => toggleCutoff(cutoff)}
                className="w-full bg-white rounded-2xl shadow px-4 py-3 flex items-center justify-between"
              >
                <span className="font-semibold flex items-center gap-2 text-sm">
                  {cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}
                  {closed && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ CLOSED</span>
                  )}
                </span>
                <span className="text-sm text-stone-400 flex items-center gap-2">
                  <span className="tabular-nums text-emerald-700 font-semibold">{peso(s.surplus)}</span>
                  ▸
                </span>
              </button>
            </section>
          );
        }
```

And make the expanded header collapsible: replace the `<h2>` (lines 135-140) with:

```tsx
            <h2 className="font-semibold mb-1 flex items-center gap-2">
              <button onClick={() => toggleCutoff(cutoff)} className="flex items-center gap-2">
                {cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}
                {editable && closed && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ CLOSED</span>
                )}
                <span className="text-stone-300 text-xs">▾</span>
              </button>
            </h2>
```

- [ ] **Step 4: Restart confirm dialog**

Next to the existing `{confirmLine && ...}` dialog (line 247), add:

```tsx
      {confirmRestart && (
        <ConfirmDialog
          title={`Restart ${monthLabel(viewedKey)}?`}
          message="Lines are regenerated fresh from your template: ticks, inline edits, skips, and one-offs are cleared, and the debt payments and savings moves made by ticking are rolled back. Logged expenses are kept. A backup is saved first (Settings → Backups)."
          confirmLabel="Restart"
          onConfirm={async () => {
            await restartMonth(viewedKey);
            setConfirmRestart(false);
          }}
          onCancel={() => setConfirmRestart(false)}
        />
      )}
```

---

### Task 4: Orchestrator verification (not for the subagent)

- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run --no-file-parallelism`
- [ ] `npx vite build`
- [ ] Diff review, commit, push to main (deploy authorized); confirm Actions green
