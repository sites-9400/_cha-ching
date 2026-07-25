# Export This Month to CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "This month" row to Settings → Export CSV that downloads the currently-browsed month's lines plus the debt payments made that month.

**Architecture:** All logic lives in one new pure module, `src/lib/monthExport.ts`, which turns `(lines, payments, debts, monthKey)` into flat CSV rows and owns its column definitions. The UI change is one entry in the existing `exports` array in `ExportData.tsx`, reusing the `toCsv` / `downloadCsv` helpers already in `src/lib/export.ts`. No Firestore reads are added — `ExportData` already has debts and payments, and the month's lines come from `useMonth()`.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Vitest, Firebase Firestore v11, Tailwind v4.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-export-month-csv-design.md`.
- Pure logic goes in `src/lib/*.ts` with a colocated `*.test.ts`; components never contain money/row math.
- TypeScript is strict — no `any`, no non-null assertions.
- Verification commands: `npm run typecheck`, `npx vitest run`, `npm run build`.
- Do NOT run any `git push` or deploy command. Committing locally is expected; the reviewer handles push.
- Columns, in this exact order and with these exact header labels:
  `Cutoff`, `Name`, `Amount`, `Channel`, `Status`, `Type`, `Pays debt`.
- `Type` values are exactly `recurring`, `one-off`, `debt-payment`.
- Filename format is exactly `month-<monthKey>.csv`, e.g. `month-2026-07.csv`.

---

### Task 1: Pure row builder — `src/lib/monthExport.ts`

**Files:**
- Create: `src/lib/monthExport.ts`
- Create: `src/lib/monthExport.test.ts`
- Read for context: `src/lib/export.ts` (the `Column<T>` type), `src/lib/lineSort.ts` (`lineComparators`), `src/lib/types.ts` (`MonthLine`, `Debt`), `src/lib/reconcile.test.ts` (test-fixture style to copy)

**Interfaces:**
- Consumes: `Column<T>` from `./export`; `lineComparators` from `./lineSort`; `MonthLine`, `Debt` from `./types`.
- Produces, for Task 2:
  - `interface ExportPayment { debtId: string; amount: number; monthKey: string; cutoff: 1 | 2; lineId?: string }`
  - `interface MonthExportRow { cutoff: number; name: string; amount: number; channel: string; status: string; type: "recurring" | "one-off" | "debt-payment"; paysDebt: string }`
  - `function monthExportRows(lines: readonly MonthLine[], payments: readonly ExportPayment[], debts: readonly Debt[], monthKey: string): MonthExportRow[]`
  - `const MONTH_EXPORT_COLUMNS: Column<MonthExportRow>[]`

**Background you need:**

A month line that pays a debt (`line.debtId`) logs a payment document when it's ticked PAID — see `toggleLinePaid` in `src/lib/repo.ts`, which writes `lineId: line.id` onto that payment. Payments logged from the Debt Plan screen (`logDebtPayment`) have **no** `lineId`. That field is the only way to tell the two apart, and skipping `lineId`-carrying payments is what stops the same peso appearing twice in the file.

- [ ] **Step 1: Write the failing test**

Create `src/lib/monthExport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { monthExportRows, type ExportPayment } from "./monthExport";
import type { Debt, MonthLine } from "./types";

const M = (o: Partial<MonthLine>): MonthLine =>
  ({ id: "l", name: "Line", amount: 0, channel: "CIMB", cutoff: 1, order: 0, status: "", oneOff: false, ...o });
const P = (o: Partial<ExportPayment>): ExportPayment =>
  ({ debtId: "d1", amount: 0, monthKey: "2026-07", cutoff: 1, ...o });
const D = (o: Partial<Debt>): Debt =>
  ({ id: "d1", name: "RCBC Credit", startingBalance: 0, currentBalance: 0, payoffOrder: 1,
     channel: "RCBC CREDIT", isBNPL: false, active: true, ...o });

describe("monthExportRows", () => {
  it("maps a month line to a row with every column filled", () => {
    const rows = monthExportRows(
      [M({ name: "Rent", amount: 15000, channel: "CIMB", cutoff: 1, status: "PAID" })],
      [], [], "2026-07",
    );
    expect(rows).toEqual([{
      cutoff: 1, name: "Rent", amount: 15000, channel: "CIMB",
      status: "PAID", type: "recurring", paysDebt: "",
    }]);
  });

  it("types a one-off line as one-off", () => {
    const rows = monthExportRows([M({ name: "Birthday gift", oneOff: true })], [], [], "2026-07");
    expect(rows[0].type).toBe("one-off");
  });

  it("resolves a line's debtId to the debt name in Pays debt", () => {
    const rows = monthExportRows(
      [M({ name: "RCBC card", debtId: "d1" })], [], [D({ id: "d1", name: "RCBC Credit" })], "2026-07",
    );
    expect(rows[0].paysDebt).toBe("RCBC Credit");
  });

  it("leaves Pays debt blank when the debt was deleted", () => {
    const rows = monthExportRows([M({ debtId: "gone" })], [], [], "2026-07");
    expect(rows[0].paysDebt).toBe("");
  });

  it("excludes a payment that came from ticking a line (has lineId)", () => {
    const rows = monthExportRows(
      [M({ id: "a", name: "RCBC card", amount: 4000, debtId: "d1" })],
      [P({ debtId: "d1", amount: 4000, lineId: "a" })],
      [D({})], "2026-07",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("RCBC card");
  });

  it("includes a Debt Plan payment (no lineId) as a debt-payment row", () => {
    const rows = monthExportRows(
      [], [P({ debtId: "d1", amount: 2500, cutoff: 2 })],
      [D({ id: "d1", name: "Home Credit", channel: "CIMB" })], "2026-07",
    );
    expect(rows).toEqual([{
      cutoff: 2, name: "Extra payment", amount: 2500, channel: "CIMB",
      status: "PAID", type: "debt-payment", paysDebt: "Home Credit",
    }]);
  });

  it("labels a payment whose debt was deleted rather than dropping it", () => {
    const rows = monthExportRows([], [P({ debtId: "gone", amount: 900 })], [], "2026-07");
    expect(rows[0]).toMatchObject({ name: "Extra payment", amount: 900, paysDebt: "Unknown debt", channel: "" });
  });

  it("excludes payments belonging to another month", () => {
    const rows = monthExportRows([], [P({ monthKey: "2026-06", amount: 999 })], [D({})], "2026-07");
    expect(rows).toEqual([]);
  });

  it("sorts by cutoff, lines before debt payments within a cutoff", () => {
    const rows = monthExportRows(
      [M({ name: "Netflix", cutoff: 2, order: 1 }), M({ name: "Rent", cutoff: 1, order: 2 }),
       M({ name: "Allowance", cutoff: 1, order: 1 })],
      [P({ cutoff: 1, amount: 500 })],
      [D({})], "2026-07",
    );
    expect(rows.map((r) => r.name)).toEqual(["Allowance", "Rent", "Extra payment", "Netflix"]);
  });

  it("returns an empty array for a month with nothing in it", () => {
    expect(monthExportRows([], [], [], "2026-07")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/monthExport.test.ts`
Expected: FAIL — cannot resolve `./monthExport`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/monthExport.ts`:

```ts
import type { Column } from "./export";
import { lineComparators } from "./lineSort";
import type { Debt, MonthLine } from "./types";

/** The payment fields this module needs. Structurally satisfied by `PaymentRec`
 *  (src/components/DebtPlan.tsx) — kept local so lib code never imports a component. */
export interface ExportPayment {
  debtId: string;
  amount: number;
  monthKey: string;
  cutoff: 1 | 2;
  /** Present when the payment came from ticking a month line PAID (`toggleLinePaid`). */
  lineId?: string;
}

export interface MonthExportRow {
  cutoff: number;
  name: string;
  amount: number;
  channel: string;
  status: string;
  type: "recurring" | "one-off" | "debt-payment";
  paysDebt: string;
}

export const MONTH_EXPORT_COLUMNS: Column<MonthExportRow>[] = [
  { key: "cutoff", label: "Cutoff" },
  { key: "name", label: "Name" },
  { key: "amount", label: "Amount" },
  { key: "channel", label: "Channel" },
  { key: "status", label: "Status" },
  { key: "type", label: "Type" },
  { key: "paysDebt", label: "Pays debt" },
];

/** Flatten a month into CSV rows: every line, plus the debt payments logged that
 *  month from the Debt Plan screen. Payments carrying a `lineId` are skipped —
 *  their line is already a row, so including them would double-count. Pure. */
export function monthExportRows(
  lines: readonly MonthLine[],
  payments: readonly ExportPayment[],
  debts: readonly Debt[],
  monthKey: string,
): MonthExportRow[] {
  const byId = new Map(debts.map((d) => [d.id, d]));

  const lineRows: MonthExportRow[] = [...lines]
    .sort((a, b) => (a.cutoff - b.cutoff) || lineComparators.order(a, b))
    .map((l) => ({
      cutoff: l.cutoff,
      name: l.name,
      amount: l.amount,
      channel: String(l.channel),
      status: l.status,
      type: l.oneOff ? "one-off" : "recurring",
      paysDebt: (l.debtId ? byId.get(l.debtId)?.name : undefined) ?? "",
    }));

  const paymentRows: MonthExportRow[] = payments
    .filter((p) => p.monthKey === monthKey && !p.lineId)
    .map((p) => {
      const debt = byId.get(p.debtId);
      return {
        cutoff: p.cutoff,
        name: "Extra payment",
        amount: p.amount,
        channel: debt ? String(debt.channel) : "",
        status: "PAID",
        type: "debt-payment" as const,
        paysDebt: debt?.name ?? "Unknown debt",
      };
    });

  // Array.prototype.sort is stable, so equal cutoffs keep lines ahead of payments.
  return [...lineRows, ...paymentRows].sort((a, b) => a.cutoff - b.cutoff);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/monthExport.test.ts`
Expected: PASS, 10 tests.

Then run the full suite and typecheck — nothing else should move:
Run: `npx vitest run && npm run typecheck`
Expected: all tests pass, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/monthExport.ts src/lib/monthExport.test.ts
git commit -m "feat: pure month->CSV row builder with debt-payment dedupe"
```

---

### Task 2: Wire the row into Settings → Export CSV

**Files:**
- Modify: `src/components/DebtPlan.tsx:10-12` (add `lineId?: string` to `PaymentRec`)
- Modify: `src/components/settings/ExportData.tsx` (add the export row)

**Interfaces:**
- Consumes: `monthExportRows`, `MONTH_EXPORT_COLUMNS` from `../../lib/monthExport` (Task 1); `useMonth()` from `../MonthProvider`, which returns `{ viewedKey: string; lines: MonthLine[]; ... }`.
- Produces: nothing — this is the last task.

**Background you need:**

`Settings` renders inside `MonthProvider` (see `src/components/AppShell.tsx`), so `useMonth()` works in `ExportData`. Using `useMonth().lines` rather than fetching `monthLines(key)` directly matters: for a future month that hasn't been started, no Firestore doc exists and the provider supplies generated lines instead. A direct fetch would export an empty file for those months.

- [ ] **Step 1: Declare `lineId` on `PaymentRec`**

In `src/components/DebtPlan.tsx`, the interface currently reads:

```ts
export interface PaymentRec {
  id: string; debtId: string; amount: number; monthKey: string; cutoff: 1 | 2; date: string;
}
```

Change it to:

```ts
export interface PaymentRec {
  id: string; debtId: string; amount: number; monthKey: string; cutoff: 1 | 2; date: string;
  /** Set when the payment came from ticking a month line PAID (`toggleLinePaid`). */
  lineId?: string;
}
```

The field is already written by `src/lib/repo.ts` — this only makes it visible to TypeScript.

- [ ] **Step 2: Add the export row**

In `src/components/settings/ExportData.tsx`, add these imports alongside the existing ones:

```ts
import { useMonth } from "../MonthProvider";
import { monthExportRows, MONTH_EXPORT_COLUMNS } from "../../lib/monthExport";
```

Inside the component, next to the existing `useCollection` calls, add:

```ts
const { viewedKey, lines } = useMonth();
```

Then append this entry to the `exports` array, **after** the existing "Debt payments" entry:

```ts
{
  label: `This month (${viewedKey})`, file: `month-${viewedKey}.csv`,
  run: () => downloadCsv(
    `month-${viewedKey}.csv`,
    toCsv(monthExportRows(lines, payments, debts, viewedKey), MONTH_EXPORT_COLUMNS),
  ),
},
```

Leave the existing three entries and all JSX untouched — the list renders from the array, so no markup change is needed.

- [ ] **Step 3: Verify types and the full suite**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: no TypeScript errors, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/DebtPlan.tsx src/components/settings/ExportData.tsx
git commit -m "feat: export the browsed month to CSV from Settings"
```

---

## Manual verification (reviewer, after Task 2)

1. `npm run dev`, unlock, go to Settings → Export CSV.
2. The fourth row reads `This month (2026-07)`. Tap it — `month-2026-07.csv` downloads.
3. Open it: header row is `Cutoff,Name,Amount,Channel,Status,Type,Pays debt`; cutoff-1 rows precede cutoff-2 rows.
4. A recurring line that pays a debt and is ticked PAID appears **once**, with the debt name in `Pays debt`.
5. A payment logged from the Debt Plan screen appears as its own `Extra payment` / `debt-payment` row.
6. On the Month tab, page back to the previous month, return to Settings → Export CSV: the label and the downloaded file now track that month.
