import {
  collection, deleteDoc, doc, increment, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { debtPayments, debtsCol, expensesCol, monthDoc, monthLines } from "./paths";
import type { Income, LineStatus, MonthLine } from "./types";

/** Toggle/set one month line's status. */
export async function setLineStatus(
  monthKey: string, lineId: string, status: LineStatus,
): Promise<void> {
  const ref = doc(db, monthLines(monthKey), lineId);
  await updateDoc(ref, { status, paidDate: status === "" ? "" : new Date().toISOString() });
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

/** Record a debt payment: append to history + decrement the balance atomically. */
export async function logDebtPayment(
  debtId: string, amount: number, monthKey: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, debtPayments(debtId))), {
    amount, date: new Date().toISOString(), monthKey,
  });
  batch.update(doc(db, debtsCol(), debtId), { currentBalance: increment(-amount) });
  await batch.commit();
}
