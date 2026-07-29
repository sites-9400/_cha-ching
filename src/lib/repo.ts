import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, setDoc, updateDoc, writeBatch,
  type UpdateData,
} from "firebase/firestore";
import { db } from "./firebase";
import { localIso } from "./clock";
import {
  accountsCol, categoriesCol, debtCycles, debtPayments, debtsCol, eventsCol, expensesCol, fundsCol,
  metaDoc, monthBackups, monthDoc, monthIncomes, monthLines, savingsMovesCol, subscriptionsCol,
  templateIncomes, templateLines,
} from "./paths";
import { BACKUP_KEEP, backupsToPrune, type MonthBackup } from "./backups";
import { reconcileLines } from "./reconcile";
import { activeLines, generateMonthLines, isCutoffClosed } from "./selectors";
import type {
  Account, Category, Debt, EventItem, Income, LineStatus, Meta, MonthLine, SavingsMove, SinkingFund,
  Subscription, TemplateLine,
} from "./types";

/** Strip undefined-valued keys — Firestore rejects literal `undefined`. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Toggle/set one month line's status. */
export async function setLineStatus(
  monthKey: string, lineId: string, status: LineStatus,
): Promise<void> {
  const ref = doc(db, monthLines(monthKey), lineId);
  await updateDoc(ref, { status, paidDate: status === "" ? "" : localIso() });
}

/**
 * Toggle a line's PAID status. If the line is linked to a debt (`debtId`), also log
 * a debt payment for its amount when marking PAID, and reverse that payment when
 * unticking — so ticking a BNPL/loan line actually pays the debt down. The payment
 * carries `lineId` so untick finds and reverses exactly it.
 */
export async function toggleLinePaid(monthKey: string, line: MonthLine): Promise<void> {
  const goingPaid = line.status === "";
  if (!line.debtId) {
    await setLineStatus(monthKey, line.id, goingPaid ? "PAID" : "");
    return;
  }
  const lineRef = doc(db, monthLines(monthKey), line.id);
  const debtRef = doc(db, debtsCol(), line.debtId);
  const batch = writeBatch(db);

  if (goingPaid) {
    batch.set(doc(collection(db, debtPayments(line.debtId))), {
      amount: line.amount, date: localIso(),
      monthKey, cutoff: line.cutoff, lineId: line.id,
    });
    batch.update(debtRef, { currentBalance: increment(-line.amount) });
    batch.update(lineRef, { status: "PAID", paidDate: localIso() });
  } else {
    const snap = await getDocs(collection(db, debtPayments(line.debtId)));
    for (const d of snap.docs) {
      if (d.data().lineId === line.id) {
        batch.delete(d.ref);
        batch.update(debtRef, { currentBalance: increment(d.data().amount as number) });
      }
    }
    batch.update(lineRef, { status: "", paidDate: "" });
  }
  await batch.commit();
}

/** Tick/untick an income as RECEIVED for a month (stored on the month meta doc).
 *  An income flagged `toSavings` also moves the money: receiving credits the
 *  savings balance and records a move; unticking reverses both. Mirrors
 *  `toggleLinePaid`'s untick path — the move is located by incomeId + monthKey. */
export async function setIncomeReceived(
  monthKey: string, income: Income, received: boolean,
): Promise<void> {
  if (!income.toSavings) {
    await updateDoc(doc(db, monthDoc(monthKey)), { [`receivedIncomes.${income.id}`]: received });
    return;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, monthDoc(monthKey)), { [`receivedIncomes.${income.id}`]: received });

  if (received) {
    batch.set(doc(collection(db, savingsMovesCol())), {
      amount: income.amount, direction: "in", source: income.name,
      date: localIso(), incomeId: income.id, monthKey,
    });
    batch.update(doc(db, metaDoc()), { savingsBalance: increment(income.amount) });
  } else {
    // Reverse only what was actually recorded — if the move was already deleted
    // by hand, the balance must not be decremented a second time.
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

/** Create a month: its meta doc + all line docs, in one batch. */
export async function writeMonth(
  monthKey: string, lines: MonthLine[], incomes: Income[],
): Promise<void> {
  await backupMonth(monthKey, "month generate"); // no-op unless lines already exist
  const batch = writeBatch(db);
  const monthMetaRef = doc(db, monthDoc(monthKey));
  batch.set(monthMetaRef, {
    startedAt: localIso(),
    incomes: incomes.map((i) => ({ name: i.name, amount: i.amount, received: false })),
  });
  for (const l of lines) batch.set(doc(db, monthLines(monthKey), l.id), l);
  await batch.commit();
}

export interface ExpenseInput {
  amount: number; category: string; channel: string; note: string; date: string;
  envelopeLineId?: string; // month line the spending draws from; absent = unplanned
  fundedBySavings?: boolean; // paid from savings — skips cutoff math, deducts savingsBalance
  budgetGroup?: string; // budget-group pool the spending draws from (e.g. "Allowance")
  paidWithDebtId?: string; // charged to this debt — skips cutoff math, grows currentBalance
}

export async function addExpense(e: ExpenseInput): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, expensesCol())), e);
  if (e.fundedBySavings) batch.update(doc(db, metaDoc()), { savingsBalance: increment(-e.amount) });
  if (e.paidWithDebtId) batch.update(doc(db, debtsCol(), e.paidWithDebtId), { currentBalance: increment(e.amount) });
  await batch.commit();
}

export async function deleteExpense(id: string): Promise<void> {
  const ref = doc(db, expensesCol(), id);
  const snap = await getDoc(ref);
  const batch = writeBatch(db);
  batch.delete(ref);
  if (snap.exists() && snap.data().fundedBySavings) {
    batch.update(doc(db, metaDoc()), { savingsBalance: increment(snap.data().amount as number) });
  }
  const debtId = snap.exists() ? (snap.data().paidWithDebtId as string | undefined) : undefined;
  if (debtId) {
    const debtRef = doc(db, debtsCol(), debtId);
    if ((await getDoc(debtRef)).exists()) {
      batch.update(debtRef, { currentBalance: increment(-(snap.data()!.amount as number)) });
    }
  }
  await batch.commit();
}

/** Patch a logged expense. `envelopeLineId`/`fundedBySavings: null` removes the
 *  field via deleteField() — Firestore rejects literal undefined. Savings-funded
 *  changes (amount edits, toggling the source) adjust savingsBalance by the delta;
 *  card-paid changes adjust the affected debt balances the same way. */
export async function updateExpense(
  id: string,
  patch: Partial<Omit<ExpenseInput, "envelopeLineId" | "fundedBySavings" | "budgetGroup" | "paidWithDebtId">>
    & { envelopeLineId?: string | null; fundedBySavings?: boolean | null; budgetGroup?: string | null;
        paidWithDebtId?: string | null },
): Promise<void> {
  const ref = doc(db, expensesCol(), id);
  const snap = await getDoc(ref);
  const old = (snap.data() ?? {}) as ExpenseInput;

  const { envelopeLineId, fundedBySavings, budgetGroup, paidWithDebtId, ...rest } = patch;
  const data: UpdateData<ExpenseInput> = { ...rest };
  if (envelopeLineId === null) data.envelopeLineId = deleteField();
  else if (envelopeLineId !== undefined) data.envelopeLineId = envelopeLineId;
  if (fundedBySavings === null || fundedBySavings === false) data.fundedBySavings = deleteField();
  else if (fundedBySavings === true) data.fundedBySavings = true;
  if (budgetGroup === null) data.budgetGroup = deleteField();
  else if (budgetGroup !== undefined) data.budgetGroup = budgetGroup;
  if (paidWithDebtId === null) data.paidWithDebtId = deleteField();
  else if (paidWithDebtId !== undefined) data.paidWithDebtId = paidWithDebtId;

  // Savings delta: what the old doc deducted vs what the new state should deduct.
  const wasFunded = !!old.fundedBySavings;
  const nowFunded = fundedBySavings === undefined ? wasFunded : fundedBySavings === true;
  const oldDeduct = wasFunded ? old.amount : 0;
  const newDeduct = nowFunded ? (patch.amount ?? old.amount) : 0;
  const delta = oldDeduct - newDeduct; // positive → give back to savings

  // Debt delta: reverse what the old doc charged, apply what the new state charges.
  const oldDebtId = old.paidWithDebtId;
  const newDebtId = paidWithDebtId === undefined ? oldDebtId : (paidWithDebtId ?? undefined);
  const newAmount = patch.amount ?? old.amount;
  const debtOps: { debtId: string; delta: number }[] = [];
  if (oldDebtId === newDebtId) {
    if (oldDebtId && newAmount !== old.amount) debtOps.push({ debtId: oldDebtId, delta: newAmount - old.amount });
  } else {
    if (oldDebtId) debtOps.push({ debtId: oldDebtId, delta: -old.amount });
    if (newDebtId) debtOps.push({ debtId: newDebtId, delta: newAmount });
  }

  const batch = writeBatch(db);
  batch.update(ref, data);
  if (delta !== 0) batch.update(doc(db, metaDoc()), { savingsBalance: increment(delta) });
  for (const op of debtOps) {
    const debtRef = doc(db, debtsCol(), op.debtId);
    if ((await getDoc(debtRef)).exists()) batch.update(debtRef, { currentBalance: increment(op.delta) });
  }
  await batch.commit();
}

/** Upsert a card's statement cycle (doc id = statement-month "YYYY-MM"). Idempotent. */
export async function setDebtCycle(
  debtId: string, cycleKey: string,
  cycle: { statementDate: string; dueDate: string; statementBalance: number; minimumDue: number },
): Promise<void> {
  await setDoc(doc(db, debtCycles(debtId), cycleKey), cycle);
}

/** Set a debt's monthly minimum payment. */
export async function setDebtMinimum(debtId: string, amount: number): Promise<void> {
  await updateDoc(doc(db, debtsCol(), debtId), { minimum: amount });
}

/** Record a debt payment: append to history (with cutoff) + decrement balance atomically. */
export async function logDebtPayment(
  debtId: string, amount: number, monthKey: string, cutoff: 1 | 2,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, debtPayments(debtId))), {
    amount, date: localIso(), monthKey, cutoff,
  });
  batch.update(doc(db, debtsCol(), debtId), { currentBalance: increment(-amount) });
  await batch.commit();
}

/** Undo a payment: delete the payment doc + restore the balance atomically. */
export async function undoDebtPayment(
  debtId: string, paymentId: string, amount: number,
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, debtPayments(debtId), paymentId));
  batch.update(doc(db, debtsCol(), debtId), { currentBalance: increment(amount) });
  await batch.commit();
}

// ── Settings CRUD (M3b) ──────────────────────────────────────────────────────

/** Create a debt with a generated id. */
export async function addDebt(d: Omit<Debt, "id">): Promise<void> {
  await setDoc(doc(collection(db, debtsCol())), d);
}

/** Patch a debt's fields. */
export async function updateDebt(id: string, patch: Partial<Debt>): Promise<void> {
  await updateDoc(doc(db, debtsCol(), id), patch);
}

/** Hard-delete a debt AND its payments subcollection in one batch (no orphaned ghosts). */
export async function deleteDebt(id: string): Promise<void> {
  const batch = writeBatch(db);
  const pays = await getDocs(collection(db, debtPayments(id)));
  pays.forEach((p) => batch.delete(p.ref));
  batch.delete(doc(db, debtsCol(), id));
  await batch.commit();
}

export async function addTemplateLine(l: Omit<TemplateLine, "id">): Promise<void> {
  await setDoc(doc(collection(db, templateLines())), l);
}
export async function updateTemplateLine(id: string, patch: Partial<TemplateLine>): Promise<void> {
  await updateDoc(doc(db, templateLines(), id), patch);
}
export async function deleteTemplateLine(id: string): Promise<void> {
  await deleteDoc(doc(db, templateLines(), id));
}
export async function addTemplateIncome(i: Omit<Income, "id">): Promise<void> {
  await setDoc(doc(collection(db, templateIncomes())), i);
}
export async function updateTemplateIncome(id: string, patch: Partial<Income>): Promise<void> {
  await updateDoc(doc(db, templateIncomes(), id), patch);
}
export async function deleteTemplateIncome(id: string): Promise<void> {
  await deleteDoc(doc(db, templateIncomes(), id));
}

export async function addCategory(c: Omit<Category, "id">): Promise<void> {
  await setDoc(doc(collection(db, categoriesCol())), c);
}
export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  await updateDoc(doc(db, categoriesCol(), id), patch);
}
/** Set or clear (null) a category's monthly budget — clearing deletes the field. */
export async function setCategoryBudget(id: string, budget: number | null): Promise<void> {
  await updateDoc(doc(db, categoriesCol(), id), { budget: budget === null ? deleteField() : budget });
}
export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, categoriesCol(), id));
}

export async function addFund(fund: Omit<SinkingFund, "id">): Promise<void> {
  await setDoc(doc(collection(db, fundsCol())), fund);
}
export async function updateFund(id: string, patch: Partial<SinkingFund>): Promise<void> {
  await updateDoc(doc(db, fundsCol(), id), patch);
}
export async function deleteFund(id: string): Promise<void> {
  await deleteDoc(doc(db, fundsCol(), id));
}

export async function addEvent(e: Omit<EventItem, "id">): Promise<void> {
  await setDoc(doc(collection(db, eventsCol())), e);
}
export async function updateEvent(id: string, patch: Partial<EventItem>): Promise<void> {
  await updateDoc(doc(db, eventsCol(), id), patch);
}
export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, eventsCol(), id));
}

export async function addSubscription(s: Omit<Subscription, "id">): Promise<void> {
  await setDoc(doc(collection(db, subscriptionsCol())), stripUndefined(s));
}
export async function updateSubscription(id: string, patch: Partial<Subscription>): Promise<void> {
  await updateDoc(doc(db, subscriptionsCol(), id), stripUndefined(patch));
}
export async function deleteSubscription(id: string): Promise<void> {
  await deleteDoc(doc(db, subscriptionsCol(), id));
}

/** Patch the household meta (savingsBalance, floor, currency) on the root doc. */
export async function updateMeta(patch: Partial<Meta>): Promise<void> {
  await updateDoc(doc(db, metaDoc()), patch);
}

/** Record a savings movement and move the balance in the same batch, so the
 *  balance can never drift from the history that explains it. */
export async function addSavingsMove(move: Omit<SavingsMove, "id">): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, savingsMovesCol())), stripUndefined(move));
  batch.update(doc(db, metaDoc()), {
    savingsBalance: increment(move.direction === "in" ? move.amount : -move.amount),
  });
  await batch.commit();
}

/** Undo a movement: delete it and reverse its effect on the balance. */
export async function deleteSavingsMove(move: SavingsMove): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, savingsMovesCol(), move.id));
  batch.update(doc(db, metaDoc()), {
    savingsBalance: increment(move.direction === "in" ? -move.amount : move.amount),
  });
  await batch.commit();
}

// ── Accounts (custom channels + account numbers) ─────────────────────────────

export async function addAccount(a: Omit<Account, "id">): Promise<void> {
  await setDoc(doc(collection(db, accountsCol())), a);
}
export async function updateAccount(id: string, patch: Partial<Account>): Promise<void> {
  await updateDoc(doc(db, accountsCol(), id), patch);
}
export async function deleteAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, accountsCol(), id));
}
/** Set/override an account's number: patch an existing doc or create one by name. */
export async function setAccountNumber(existing: Account | undefined, name: string, number: string): Promise<void> {
  if (existing) await updateDoc(doc(db, accountsCol(), existing.id), { number });
  else await setDoc(doc(collection(db, accountsCol())), { name, number });
}

// ── Month lifecycle (M6) ─────────────────────────────────────────────────────

/** Add a one-off month line (oneOff:true) to a month. */
export async function addMonthLine(monthKey: string, line: Omit<MonthLine, "id">): Promise<void> {
  await setDoc(doc(collection(db, monthLines(monthKey))), line);
}
export async function deleteMonthLine(monthKey: string, id: string): Promise<void> {
  await deleteDoc(doc(db, monthLines(monthKey), id));
}
/** Remove a line from THIS month only, keeping the template intact. The doc is
 *  kept (flagged `skipped`) so the skip can be undone, and `overridden` stops
 *  template sync from resurrecting it. A ticked debt line is reversed first —
 *  its payment doc is deleted and the debt's balance restored — all in one
 *  batch, so a failure can't strand a restored balance without its payment. */
export async function skipLineForMonth(monthKey: string, line: MonthLine): Promise<void> {
  const batch = writeBatch(db);
  if (line.status !== "" && line.debtId) {
    const snap = await getDocs(collection(db, debtPayments(line.debtId)));
    for (const d of snap.docs) {
      if (d.data().lineId === line.id) {
        batch.delete(d.ref);
        batch.update(doc(db, debtsCol(), line.debtId), {
          currentBalance: increment(d.data().amount as number),
        });
      }
    }
  }
  batch.update(doc(db, monthLines(monthKey), line.id), {
    status: "", paidDate: "", overridden: true, skipped: true,
  });
  await batch.commit();
}

/** Undo a skip. Clearing `overridden` re-arms template sync, so the line
 *  refreshes from the template on the next sync. */
export async function unskipLine(monthKey: string, id: string): Promise<void> {
  await updateDoc(doc(db, monthLines(monthKey), id), { skipped: false, overridden: false });
}

/** Inline-edit a month line (name/amount/channel) for this month only; marks it
 *  overridden so a later template sync won't clobber the change. */
export async function updateMonthLine(
  monthKey: string, id: string, patch: Partial<Pick<MonthLine, "name" | "amount" | "channel" | "debtId" | "isEnvelope" | "budgetGroup">>,
): Promise<void> {
  await updateDoc(doc(db, monthLines(monthKey), id), { ...patch, overridden: true });
}
/** Add a one-off income to a month's incomes subcollection. */
export async function addMonthIncome(monthKey: string, income: Omit<Income, "id">): Promise<void> {
  await setDoc(doc(collection(db, monthIncomes(monthKey))), income);
}
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

// ── Month backups (safety snapshots) ─────────────────────────────────────────

/**
 * Snapshot a month's restorable state (lines + one-off incomes + received
 * flags) into months/{key}/backups/{ISO timestamp}, then prune to the newest
 * BACKUP_KEEP. No-op for a month with no lines. Called before any batch that
 * rewrites month lines, so a buggy write is always one Restore away from undone.
 */
export async function backupMonth(monthKey: string, reason: string): Promise<void> {
  const [lSnap, iSnap, metaSnap, bSnap] = await Promise.all([
    getDocs(collection(db, monthLines(monthKey))),
    getDocs(collection(db, monthIncomes(monthKey))),
    getDoc(doc(db, monthDoc(monthKey))),
    getDocs(collection(db, monthBackups(monthKey))),
  ]);
  if (lSnap.empty) return;
  const backup: Omit<MonthBackup, "id"> = {
    reason,
    lines: lSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as MonthBackup["lines"],
    incomes: iSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as MonthBackup["incomes"],
    receivedIncomes: (metaSnap.data()?.receivedIncomes as Record<string, boolean> | undefined) ?? {},
  };
  const id = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(doc(db, monthBackups(monthKey), id), backup);
  for (const old of backupsToPrune([...bSnap.docs.map((d) => d.id), id], BACKUP_KEEP)) {
    batch.delete(doc(db, monthBackups(monthKey), old));
  }
  await batch.commit();
}

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

/** Reconcile a month's template-derived lines to the current template (keeps ticks + one-offs). */
export async function syncMonthFromTemplate(monthKey: string): Promise<void> {
  await backupMonth(monthKey, "template sync");
  const [tSnap, mSnap] = await Promise.all([
    getDocs(collection(db, templateLines())),
    getDocs(collection(db, monthLines(monthKey))),
  ]);
  const template = tSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TemplateLine[];
  const lines = mSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as MonthLine[];
  const closed = new Set(([1, 2] as const).filter((c) => isCutoffClosed(activeLines(lines), c)));
  const { upserts, deletes, patches } = reconcileLines(template, lines, closed);
  const batch = writeBatch(db);
  for (const l of upserts) {
    const { id, ...rest } = l;
    batch.set(doc(db, monthLines(monthKey), id), rest);
  }
  for (const id of deletes) batch.delete(doc(db, monthLines(monthKey), id));
  // Budget metadata flowing into closed (frozen) cutoffs — update, never replace.
  for (const p of patches) {
    batch.update(doc(db, monthLines(monthKey), p.id), { isEnvelope: p.isEnvelope, budgetGroup: p.budgetGroup });
  }
  await batch.commit();
}

/** Generate a not-yet-existing month for real (used by "Start this month"). Idempotent. */
export async function startMonth(monthKey: string): Promise<void> {
  const metaRef = doc(db, monthDoc(monthKey));
  if ((await getDoc(metaRef)).exists()) return;
  const [tSnap, eSnap, iSnap] = await Promise.all([
    getDocs(collection(db, templateLines())),
    getDocs(collection(db, eventsCol())),
    getDocs(collection(db, templateIncomes())),
  ]);
  const template = tSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TemplateLine[];
  const events = eSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as EventItem[];
  const incomes = iSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Income[];
  await writeMonth(monthKey, generateMonthLines(template, events, monthKey), incomes);
}

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
  batch.set(doc(db, monthDoc(monthKey)), { startedAt: localIso(), receivedIncomes: {} });
  await batch.commit();
}
