import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  accountsCol, categoriesCol, debtCycles, debtPayments, debtsCol, eventsCol, expensesCol, fundsCol,
  metaDoc, monthDoc, monthIncomes, monthLines, templateIncomes, templateLines,
} from "./paths";
import { reconcileLines } from "./reconcile";
import { generateMonthLines, isCutoffClosed } from "./selectors";
import type {
  Account, Category, Debt, EventItem, Income, LineStatus, Meta, MonthLine, SinkingFund, TemplateLine,
} from "./types";

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
}

export async function addExpense(e: ExpenseInput): Promise<void> {
  await setDoc(doc(collection(db, expensesCol())), e);
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, expensesCol(), id));
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

/** Reconcile a month's template-derived lines to the current template (keeps ticks + one-offs). */
export async function syncMonthFromTemplate(monthKey: string): Promise<void> {
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
