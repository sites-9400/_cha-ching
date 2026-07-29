# Audit batch 1 — Local-time date stamps

**Date:** 2026-07-29 · **Status:** Approved (audit remediation, Eve: "go do by batch")

## Problem

Money-relevant timestamps are written with `new Date().toISOString()` (UTC),
but every consumer slices them as CALENDAR strings (`slice(0,7)` month,
`slice(8,10)` day-of-month → cutoff attribution, `slice(0,10)` cycle-window
comparison). The user is in the Philippines (UTC+8): anything logged
00:00–07:59 local lands on the previous calendar day — wrong cutoff, wrong
spending day, and on the 1st of a month it falls into the previous (closed)
month. `SavingsMoveDialog` additionally converts a picked local date through
UTC, storing it one day early.

## Fix

New helper in `src/lib/clock.ts`:

```ts
/** Local-time ISO stamp "YYYY-MM-DDTHH:mm:ss". Use for every stored date that
 *  is later sliced as a calendar string — toISOString() is UTC and shifts
 *  00:00–07:59 PH time onto the previous day. Sorts correctly against legacy
 *  UTC strings (same lexicographic prefix format). */
export function localIso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
```

Replace `new Date().toISOString()` with `localIso()` (import from
`./clock` / `../lib/clock`) at exactly these sites:

- `src/components/QuickAdd.tsx:64` (expense date)
- `src/components/Dashboard.tsx:57` (quick savings move date)
- `src/lib/repo.ts:29` (`setLineStatus` paidDate)
- `src/lib/repo.ts:50` (toggleLinePaid payment date)
- `src/lib/repo.ts:54` (toggleLinePaid paidDate)
- `src/lib/repo.ts:86` (setIncomeReceived savings-move date)
- `src/lib/repo.ts:113` (writeMonth startedAt)
- `src/lib/repo.ts:227` (logDebtPayment payment date)
- `src/lib/repo.ts:564` (restartMonth startedAt)

`src/components/dashboard/SavingsMoveDialog.tsx`:
- line 8: default date state becomes `localIso().slice(0, 10)`
- line 16: store the picked date directly — `date: \`${date}T12:00:00\`` —
  never round-trip through `new Date(...)`/`toISOString()`.

NOT changed: `repo.ts:446` (backup doc id — an instant label, never sliced
as a calendar date; UTC keeps ids collision-ordered), `scripts/seed.mjs`
(one-time updatedAt metadata), `EditExpenseDialog` date patching (splices a
picked local date onto the stored time suffix — already calendar-correct).

## Tests

Append to `src/lib/clock.test.ts` (create the describe if the file focuses
elsewhere — check its existing structure first):

```ts
describe("localIso", () => {
  it("formats local calendar parts with zero-padding", () => {
    const d = new Date(2026, 0, 5, 3, 7, 9); // Jan 5, 03:07:09 LOCAL
    expect(localIso(d)).toBe("2026-01-05T03:07:09");
  });
  it("keeps a pre-8am local time on the same local day (the UTC+8 bug)", () => {
    const d = new Date(2026, 7, 14, 1, 30, 0); // Aug 14, 1:30am local
    expect(localIso(d).slice(0, 10)).toBe("2026-08-14");
    expect(localIso(d).slice(8, 10)).toBe("14");
  });
});
```

Import `localIso` in the test's existing import from `./clock`.

## Compatibility

Legacy UTC strings already stored remain readable (same prefix format, all
slicing still works); they keep their historical off-by-one where it already
happened — no migration.
