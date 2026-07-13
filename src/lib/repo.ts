import {
  collection, deleteDoc, doc, getDocs, increment, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  categoriesCol, debtPayments, debtsCol, eventsCol, expensesCol, fundsCol, metaDoc,
  monthDoc, monthLines, templateIncomes, templateLines,
} from "./paths";
import type {
  Category, Debt, EventItem, Income, LineStatus, Meta, MonthLine, SinkingFund, TemplateLine,
} from "./types";

/** Toggle/set one month line's status. */
export async function setLineStatus(
  monthKey: string, lineId: string, status: LineStatus,
): Promise<void> {
  const ref = doc(db, monthLines(monthKey), lineId);
  await updateDoc(ref, { status, paidDate: status === "" ? "" : new Date().toISOString() });
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
}

export async function addExpense(e: ExpenseInput): Promise<void> {
  await setDoc(doc(collection(db, expensesCol())), e);
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, expensesCol(), id));
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
