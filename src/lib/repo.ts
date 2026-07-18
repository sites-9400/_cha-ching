import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, setDoc, updateDoc, writeBatch,
  type UpdateData,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  accountsCol, categoriesCol, debtCycles, debtPayments, debtsCol, eventsCol, expensesCol, fundsCol,
  metaDoc, monthBackups, monthDoc, monthIncomes, monthLines, subscriptionsCol, templateIncomes, templateLines,
} from "./paths";
import { BACKUP_KEEP, backupsToPrune, type MonthBackup } from "./backups";
import { reconcileLines } from "./reconcile";
import { generateMonthLines, isCutoffClosed } from "./selectors";
import type {
  Account, Category, Debt, EventItem, Income, LineStatus, Meta, MonthLine, SinkingFund, Subscription,
  TemplateLine,
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
  await updateDoc(ref, { status, paidDate: status === "" ? "" : new Date().toISOString() });
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
      amount: line.amount, date: new Date().toISOString(),
      monthKey, cutoff: line.cutoff, lineId: line.id,
    });
    batch.update(debtRef, { currentBalance: increment(-line.amount) });
    batch.update(lineRef, { status: "PAID", paidDate: new Date().toISOString() });
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

/** Tick/untick an income line as RECEIVED for a month (stored on the month meta doc). */
export async function setIncomeReceived(
  monthKey: string, incomeId: string, received: boolean,
): Promise<void> {
  await updateDoc(doc(db, monthDoc(monthKey)), { [`receivedIncomes.${incomeId}`]: received });
}

/** Create a month: its meta doc + all line docs, in one batch. */
export async function writeMonth(
  monthKey: string, lines: MonthLine[], incomes: Income[],
): Promise<void> {
  await backupMonth(monthKey, "month generate"); // no-op unless lines already exist
  const batch = writeBatch(db);
  const monthMetaRef = doc(db, monthDoc(monthKey));
  batch.set(monthMetaRef, {
    startedAt: new Date().toISOString(),
    incomes: incomes.map((i) => ({ name: i.name, amount: i.amount, received: false })),
  });
  for (const l of lines) batch.set(doc(db, monthLines(monthKey), l.id), l);
  await batch.commit();
}

export interface ExpenseInput {
  amount: number; category: string; channel: string; note: string; date: string;
  envelopeLineId?: string; // month line the spending draws from; absent = unplanned
  fundedBySavings?: boolean; // paid from savings — skips cutoff math, deducts savingsBalance
}

export async function addExpense(e: ExpenseInput): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, expensesCol())), e);
  if (e.fundedBySavings) batch.update(doc(db, metaDoc()), { savingsBalance: increment(-e.amount) });
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
  await batch.commit();
}

/** Patch a logged expense. `envelopeLineId`/`fundedBySavings: null` removes the
 *  field via deleteField() — Firestore rejects literal undefined. Savings-funded
 *  changes (amount edits, toggling the source) adjust savingsBalance by the delta. */
export async function updateExpense(
  id: string,
  patch: Partial<Omit<ExpenseInput, "envelopeLineId" | "fundedBySavings">>
    & { envelopeLineId?: string | null; fundedBySavings?: boolean | null },
): Promise<void> {
  const ref = doc(db, expensesCol(), id);
  const snap = await getDoc(ref);
  const old = (snap.data() ?? {}) as ExpenseInput;

  const { envelopeLineId, fundedBySavings, ...rest } = patch;
  const data: UpdateData<ExpenseInput> = { ...rest };
  if (envelopeLineId === null) data.envelopeLineId = deleteField();
  else if (envelopeLineId !== undefined) data.envelopeLineId = envelopeLineId;
  if (fundedBySavings === null || fundedBySavings === false) data.fundedBySavings = deleteField();
  else if (fundedBySavings === true) data.fundedBySavings = true;

  // Savings delta: what the old doc deducted vs what the new state should deduct.
  const wasFunded = !!old.fundedBySavings;
  const nowFunded = fundedBySavings === undefined ? wasFunded : fundedBySavings === true;
  const oldDeduct = wasFunded ? old.amount : 0;
  const newDeduct = nowFunded ? (patch.amount ?? old.amount) : 0;
  const delta = oldDeduct - newDeduct; // positive → give back to savings

  const batch = writeBatch(db);
  batch.update(ref, data);
  if (delta !== 0) batch.update(doc(db, metaDoc()), { savingsBalance: increment(delta) });
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
    amount, date: new Date().toISOString(), monthKey, cutoff,
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
/** Inline-edit a month line (name/amount/channel) for this month only; marks it
 *  overridden so a later template sync won't clobber the change. */
export async function updateMonthLine(
  monthKey: string, id: string, patch: Partial<Pick<MonthLine, "name" | "amount" | "channel" | "debtId" | "isEnvelope">>,
): Promise<void> {
  await updateDoc(doc(db, monthLines(monthKey), id), { ...patch, overridden: true });
}
/** Add a one-off income to a month's incomes subcollection. */
export async function addMonthIncome(monthKey: string, income: Omit<Income, "id">): Promise<void> {
  await setDoc(doc(collection(db, monthIncomes(monthKey))), income);
}
export async function deleteMonthIncome(monthKey: string, id: string): Promise<void> {
  await deleteDoc(doc(db, monthIncomes(monthKey), id));
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

/** Restore a month from a backup: current state is snapshotted first, then
 *  lines/incomes/received flags are replaced wholesale with the backup's. */
export async function restoreMonthBackup(monthKey: string, backupId: string): Promise<void> {
  const backupSnap = await getDoc(doc(db, monthBackups(monthKey), backupId));
  if (!backupSnap.exists()) return;
  const backup = backupSnap.data() as Omit<MonthBackup, "id">;
  await backupMonth(monthKey, "restore");
  const [lSnap, iSnap] = await Promise.all([
    getDocs(collection(db, monthLines(monthKey))),
    getDocs(collection(db, monthIncomes(monthKey))),
  ]);
  const batch = writeBatch(db);
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
  const closed = new Set(([1, 2] as const).filter((c) => isCutoffClosed(lines, c)));
  const { upserts, deletes } = reconcileLines(template, lines, closed);
  const batch = writeBatch(db);
  for (const l of upserts) {
    const { id, ...rest } = l;
    batch.set(doc(db, monthLines(monthKey), id), rest);
  }
  for (const id of deletes) batch.delete(doc(db, monthLines(monthKey), id));
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
