# Audit batch 2 — Money-integrity fixes

**Date:** 2026-07-29 · **Status:** Approved (audit remediation, Eve: "go do by batch")

Five verified defects from the correctness audit. All fixes mirror existing,
tested reversal patterns. Depends on batch 1's `localIso` (clock.ts).

## 1. `restoreMonthBackup` reconciles tick bookkeeping (HIGH)

Today restore swaps lines/received flags wholesale but leaves the debt
payments and savings moves the old ticks created → re-ticking after a
restore double-decrements debts / double-credits savings.

Fix: full doc-driven reconcile — reverse everything, then re-create what the
restored state implies. Replace `restoreMonthBackup` (repo.ts:457-479) with:

```ts
/** Restore a month from a backup. Tick-created bookkeeping is fully
 *  reconciled: every line payment and income savings move for the month is
 *  reversed, then re-created from the backup's ticked lines and received
 *  flags — so debt and savings balances always match the restored state.
 *  Recreated docs are stamped at restore time. Current state is snapshotted
 *  first. */
export async function restoreMonthBackup(monthKey: string, backupId: string): Promise<void> {
  const backupSnap = await getDoc(doc(db, monthBackups(monthKey), backupId));
  if (!backupSnap.exists()) return;
  const backup = backupSnap.data() as Omit<MonthBackup, "id">;
  await backupMonth(monthKey, "restore");
  const [lSnap, iSnap, dSnap, sSnap, tiSnap] = await Promise.all([
    getDocs(collection(db, monthLines(monthKey))),
    getDocs(collection(db, monthIncomes(monthKey))),
    getDocs(collection(db, debtsCol())),
    getDocs(collection(db, savingsMovesCol())),
    getDocs(collection(db, templateIncomes())),
  ]);
  const batch = writeBatch(db);
  // Reverse this month's line-generated payments and income savings moves.
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
  for (const m of sSnap.docs) {
    const data = m.data();
    if (data.monthKey === monthKey && data.incomeId) {
      batch.delete(m.ref);
      batch.update(doc(db, metaDoc()), { savingsBalance: increment(-(data.amount as number)) });
    }
  }
  // Replace lines and one-off incomes with the backup's.
  for (const d of lSnap.docs) batch.delete(d.ref);
  for (const d of iSnap.docs) batch.delete(d.ref);
  for (const l of backup.lines) {
    const { id, ...rest } = l;
    batch.set(doc(db, monthLines(monthKey), id), rest);
  }
  for (const i of backup.incomes) {
    const { id, ...rest } = i;
    batch.set(doc(db, monthIncomes(monthKey), id), rest);
  }
  batch.set(doc(db, monthDoc(monthKey)), { receivedIncomes: backup.receivedIncomes }, { merge: true });
  // Re-create the bookkeeping the restored state implies.
  const debtIds = new Set(dSnap.docs.map((d) => d.id));
  for (const l of backup.lines) {
    if (l.status !== "" && l.debtId && debtIds.has(l.debtId) && !l.skipped) {
      batch.set(doc(collection(db, debtPayments(l.debtId))), {
        amount: l.amount, date: localIso(), monthKey, cutoff: l.cutoff, lineId: l.id,
      });
      batch.update(doc(db, debtsCol(), l.debtId), { currentBalance: increment(-l.amount) });
    }
  }
  const incomeById = new Map<string, Income>([
    ...tiSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Income] as const),
    ...backup.incomes.map((i) => [i.id, i as Income] as const),
  ]);
  for (const [incomeId, received] of Object.entries(backup.receivedIncomes)) {
    const inc = incomeById.get(incomeId);
    if (received && inc?.toSavings) {
      batch.set(doc(collection(db, savingsMovesCol())), {
        amount: inc.amount, direction: "in", source: inc.name,
        date: localIso(), incomeId, monthKey,
      });
      batch.update(doc(db, metaDoc()), { savingsBalance: increment(inc.amount) });
    }
  }
  await batch.commit();
}
```

(`localIso` from `./clock`; `templateIncomes` and `Income` are already
imported in repo.ts.)

## 2. Double-tap guards on tick paths (MEDIUM)

`toggleLinePaid` / `setIncomeReceived` have no in-flight guard; two quick
taps double-log a payment or savings move. UI-level guards:

- `src/components/LineRow.tsx`: local `busy` state; the tick control ignores
  taps while a toggle is in flight:
  `if (busy) return; setBusy(true); void toggleLinePaid(...).finally(() => setBusy(false));`
  (Adapt to LineRow's actual handler structure — read the file first. Keep
  the write fire-and-forget apart from the busy flag.)
- `src/components/ThisMonth.tsx` income "receive" button: add
  `const [busyIncome, setBusyIncome] = useState<string | null>(null);` and
  guard the onClick the same way (`busyIncome === i.id` → ignore; clear in
  `.finally`).

## 3. `syncMonthFromTemplate` closed-cutoff check uses active lines (MEDIUM)

repo.ts:490 currently feeds RAW lines (including skipped, whose status is
"") to `isCutoffClosed`, so sync sees a UI-closed cutoff as open and edits
frozen history. Fix: add `activeLines` to repo.ts's existing selectors
import and change the line to:

```ts
  const closed = new Set(([1, 2] as const).filter((c) => isCutoffClosed(activeLines(lines), c)));
```

## 4. Allocation shortfall includes the target's own minimum (MEDIUM)

`src/lib/allocate.ts:49-61`: the minimums pass `continue`s the avalanche
target before counting `requiredMin`, so shortfall reads 0 while the target
card's minimum is unfunded. Restructure the loop — count every due debt's
minimum, but still reserve only for non-targets (the waterfall pays the
target first):

```ts
  // Minimums pass: count every due minimum; reserve only for non-targets
  // (the waterfall pays the target first, so it needs no reservation).
  for (const d of cands) {
    if (cutoffForDueDay(d.dueDay) !== cutoff) continue;
    const min = cycleMins?.get(d.id) ?? d.minimum ?? 0;
    if (min <= 0) continue;
    requiredMin += Math.min(min, d.currentBalance);
    if (target && d.id === target.id) continue;
    const reserve = Math.min(min, d.currentBalance, Math.max(0, remaining));
    if (reserve <= 0) continue;
    bucket(d.id).min += reserve;
    remaining -= reserve;
  }
```

Add a test to `src/lib/allocate.test.ts`: target debt with a minimum due in
this cutoff, freeCash exactly covering only the other debts' minimums →
`shortfall` equals the target's minimum (capped by its balance). Check the
existing tests; if any assert `shortfall` in a scenario where the target had
a due minimum, update the expectation to the new (correct) semantics and
note it in your report.

## 5. Income row ✕ fixes (MEDIUM)

Template incomes get a no-op ✕ (deleteMonthIncome targets the month
subcollection, but template incomes don't live there), and deleting a
received to-savings one-off leaks its savings move.

- `src/lib/types.ts` `Income` gains:
  `oneOff?: boolean; // month one-off (lives in months/{key}/incomes); template incomes lack it`
- `src/components/MonthProvider.tsx:87-90`: tag month one-offs in the merge:
  ```ts
  () => (isProjected ? templateIncomeList : [...templateIncomeList, ...monthIncomeList.map((i) => ({ ...i, oneOff: true }))]),
  ```
- `src/lib/repo.ts` `deleteMonthIncome` (currently :420-422) becomes:
  ```ts
  /** Delete a month one-off income. Its received flag is cleared, and a
   *  received to-savings income's recorded move is reversed (mirrors
   *  setIncomeReceived's untick path). */
  export async function deleteMonthIncome(monthKey: string, income: Income): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, monthIncomes(monthKey), income.id));
    batch.update(doc(db, monthDoc(monthKey)), { [`receivedIncomes.${income.id}`]: deleteField() });
    if (income.toSavings) {
      const snap = await getDocs(collection(db, savingsMovesCol()));
      for (const d of snap.docs) {
        const data = d.data();
        if (data.incomeId === income.id && data.monthKey === monthKey) {
          batch.delete(d.ref);
          batch.update(doc(db, metaDoc()), { savingsBalance: increment(-(data.amount as number)) });
        }
      }
    }
    await batch.commit();
  }
  ```
- `src/components/ThisMonth.tsx` income row: the ✕ renders only for
  `i.oneOff` and passes the whole income:
  `{editable && i.oneOff && <button onClick={() => void deleteMonthIncome(viewedKey, i)} className="text-stone-300 text-xs">✕</button>}`

## Deferred (documented, not in this batch)

- Past months re-deriving incomes from the live template (needs a snapshot
  design; changes how template edits propagate to the current month).
- Unplanned rollover asymmetry for envelope/group excess on closed cutoffs
  (documented behavior; low impact).

## Tests

allocate shortfall test (above). `restoreMonthBackup`/`deleteMonthIncome`
are Firestore-batch code (no seams) — review-covered against the tested
untick/skip patterns. Full suite must stay green.
