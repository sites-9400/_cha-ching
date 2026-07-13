/** Root document for all app data. Every Firestore path is built from here. */
export const HH = "households/main";

/** A collection directly under the household. */
export const col = (name: string): string => `${HH}/${name}`;

export const templateLines = (): string => col("template-lines");
export const templateIncomes = (): string => col("template-incomes");
export const debtsCol = (): string => col("debts");
export const debtPayments = (debtId: string): string => `${debtsCol()}/${debtId}/payments`;
export const eventsCol = (): string => col("events");
export const fundsCol = (): string => col("sinkingFunds");
export const categoriesCol = (): string => col("categories");
export const expensesCol = (): string => col("expenses");

export const monthDoc = (key: string): string => `${col("months")}/${key}`;
export const monthLines = (key: string): string => `${monthDoc(key)}/lines`;
export const monthIncomes = (key: string): string => `${monthDoc(key)}/incomes`;

/** The household root doc itself holds meta (savingsBalance, floor, currency). */
export const metaDoc = (): string => HH;
