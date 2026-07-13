# Cha-Ching — Settings Screen (Design Spec)

**Date:** 2026-07-13
**Owner:** Eve (gamaliel)
**Status:** Approved pending user review
**Parent spec:** docs/superpowers/specs/2026-07-13-cha-ching-design.md
**Milestone:** M3b (second M3 sub-milestone; follows M3a debt allocation)

## What it is

The Settings tab is still a placeholder. This feature builds the full Settings
screen from the parent design: a menu that drills into focused editors for every
piece of app data the user currently can only change via the seed script — debts,
the recurring template (lines + incomes), Quick Add categories, sinking funds, and
events — plus **Change PIN**, **Export CSV**, and **Sign out**. It turns Cha-Ching
into a self-contained app: no more editing seed data by hand.

## Goals

1. Every collection the seed script writes is editable in-app (add / edit / delete).
2. The debt list is fully manageable — including payoff-order reordering, which the
   avalanche in M3a depends on.
3. The user can sign out (currently impossible from inside the app) and change the
   PIN without touching Firebase.
4. All data is exportable to CSV for backup / the parallel-sheet shakedown.
5. Editing the template affects *future* month generation only; existing months are
   never rewritten (rollover stays idempotent).

## Non-goals (deferred to later sub-milestones)

- The Dashboard / Stats screen (debt curve, category breakdown, savings floor).
- Unplanned-expense → free-cash allocation (the M3a-review gap; separate milestone).
- Income RECEIVED ticks on This Month.
- App Check, offline indicator, monthly-rollover event accept/skip UI.
- Any change to the allocation model or how months/expenses/debt payments work.

## Architecture / navigation

`Settings.tsx` replaces the `AppShell` placeholder. It owns a local
`section: SettingsSection | null` state (no router — mirrors how `AppShell`
switches tabs). `null` → the **menu** (list of rows + Sign-out at the bottom);
a non-null value → that section's editor, rendered full-screen with a `‹ Settings`
back header that sets `section` back to `null`.

```
type SettingsSection =
  "debts" | "template" | "incomes" | "categories" | "funds" | "events" | "pin" | "export";
```

Each editor is its own focused component under `src/components/settings/`, so no
single file grows unwieldy:
- `SettingsMenu.tsx`, `DebtsEditor.tsx`, `TemplateEditor.tsx`, `IncomesEditor.tsx`,
  `CategoriesEditor.tsx`, `FundsEditor.tsx`, `EventsEditor.tsx`, `ChangePin.tsx`,
  `ExportData.tsx`.
- Each list editor subscribes live via `useCollection<T>(path)` and writes through
  the repo helpers below; the UI re-renders from Firestore, never from local copies.

## Data model changes

No Firestore schema changes. Two **type** additions in `src/lib/types.ts` (shapes
already exist in data, just not centrally typed):

```ts
export interface Category { id: string; name: string; order: number }
export interface Meta { savingsBalance: number; savingsFloor: number; currency: string }
```

`Category` is currently declared locally inside `QuickAdd.tsx`; move it to
`types.ts` and import it in both places (targeted cleanup — Settings needs it too).

## Data layer — repo helpers

New helpers in `src/lib/repo.ts`, uniform `add / update / delete` per collection,
all thin `setDoc / updateDoc / deleteDoc` wrappers built on existing `paths.ts`.
`add*` creates a doc with a generated id (`doc(collection(db, path))`); `update*`
takes an id + a `Partial<T>` patch; `delete*` takes an id.

- Debts: `addDebt(d: Omit<Debt,"id">)`, `updateDebt(id, patch: Partial<Debt>)`,
  `deleteDebt(id)`.
- Template lines: `addTemplateLine`, `updateTemplateLine`, `deleteTemplateLine`.
- Template incomes: `addTemplateIncome`, `updateTemplateIncome`, `deleteTemplateIncome`.
- Categories: `addCategory`, `updateCategory`, `deleteCategory`.
- Funds: `addFund`, `updateFund`, `deleteFund`.
- Events: `addEvent`, `updateEvent`, `deleteEvent`.
- Meta: `updateMeta(patch: Partial<Meta>)` (writes the `households/main` root doc).

**`deleteDebt` is special — the cascade.** Firestore does not delete
subcollections when a parent doc is deleted, and M3a's `collectionGroup("payments")`
subscription would keep surfacing a deleted debt's orphaned payment docs (ghost
paid-state on the plan). So `deleteDebt` reads the debt's `payments` subcollection
and, in one `writeBatch`, deletes every payment doc **and** the debt doc together.

## The nine sections

- **Debts** — list ordered by `payoffOrder`; tap a debt → form editing every field
  (`name`, `startingBalance`, `currentBalance`, `dueDay`, `minimum`, `payoffOrder`,
  `channel`, `isBNPL`, `active`). `+ Add debt` creates one. **Reorder** payoff order
  via up/down arrows that swap the `payoffOrder` value with the adjacent debt.
  **Delete** is hard-delete behind a confirm dialog (cascade above). Channel picked
  from `CHANNELS`; `isBNPL`/`active` are toggles.
- **Template lines** — CRUD `{name, amount, channel, cutoff: 1|2, order, debtId?}`.
  `debtId` optionally links a planned line to a debt (existing PAID→log-payment
  behavior). Changes regenerate *future* months only.
- **Income sources** — CRUD `{name, amount, day, cutoff: 1|2}`.
- **Categories** — add / rename / delete / reorder (up/down on `order`) the Quick
  Add category list.
- **Sinking funds** — CRUD `{name, monthlyDeposit, releaseMonths: number[], balance}`;
  `releaseMonths` chosen via a 1–12 month multi-select.
- **Events** — CRUD `{name, amount, month: "YYYY-MM", channel?, note?}`.
- **Change PIN** — form: current PIN + new 6-digit PIN + confirm. Calls
  `pinAuth.changePin(currentPin, newPin)`, which re-authenticates with the current
  PIN (`reauthenticateWithCredential` + `EmailAuthProvider.credential`) then
  `updatePassword`. Firebase requires recent auth, hence the reauth. Wrong current
  PIN → inline error, no change. New PIN must be exactly 6 digits and match confirm.
- **Export CSV** — `src/lib/export.ts` exposes pure `toCsv(rows, columns)` (and a
  small per-collection builder) returning CSV text; a `downloadCsv(filename, text)`
  util creates a `Blob` + object URL and clicks a temporary `<a>`. Delivered as
  several logical files — **Months** (all month lines), **Expenses**,
  **Debts + Payments**, **Funds** — each its own button.
- **Sign out** — a button at the bottom of the menu calling the existing (currently
  unused) `pinAuth.lock()`; returns the app to the PIN pad.

## Error handling

- **Deletes:** every delete goes through a shared confirm dialog
  (`ConfirmDialog` — generalize the `ConfirmPayDialog` pattern: title, message,
  Confirm/Cancel). No deletion without confirmation.
- **Numbers:** amount / balance / day / order fields reject blank and negative;
  Save disabled until valid.
- **Change PIN:** reauth failure (wrong current PIN) and weak/mismatched new PIN
  surface as inline messages; the account password is never touched on failure.
- **Template edits:** never rewrite an existing month — generation reads the
  template only when creating a not-yet-existing month (already true in
  `MonthProvider`). Call this out so no one "helpfully" re-syncs current months.
- **Export:** pure CSV building is total (handles empty collections → header-only
  file); download is best-effort and never mutates data.

## Testing & verification

- **Vitest unit tests** (money/format logic is the tested heart — match M1/M2):
  - `export.ts`: `toCsv` escapes fields containing commas, quotes, and newlines
    (RFC-4180 double-quote doubling); empty rows → header-only; column order
    preserved.
  - reorder swap helper: swapping adjacent `payoffOrder`/`order` values produces the
    expected pair and is a no-op at list ends.
- **Manual / browser** (controller-driven on the live site): add a debt → appears on
  Debts tab & plan; reorder payoff → plan target changes; edit a template line →
  next month reflects it, current month unchanged; delete a debt → gone from plan
  and its payments no longer ghost paid-state; change PIN → sign out → unlock with
  the new PIN; export → CSV files download and open in a spreadsheet; sign out →
  PIN pad returns.

## Build order (for the implementation plan)

1. Shared `ConfirmDialog` + `Category`/`Meta` types moved to `types.ts` + Settings
   shell (menu ↔ section state) + **Sign out** wired to `lock()`.
2. Debts editor: `addDebt`/`updateDebt`/`deleteDebt` (with cascade) + reorder + form
   + delete confirm.
3. Template lines + Income sources editors (+ their repo helpers).
4. Categories editor (+ helpers).
5. Sinking funds editor (+ helpers).
6. Events editor (+ helpers).
7. Change PIN (`pinAuth.changePin` + reauth) .
8. Export CSV (`export.ts` pure + tested, `downloadCsv` util, per-collection buttons).
9. Live verification + deploy.
