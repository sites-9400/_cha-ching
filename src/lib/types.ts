export type BuiltinChannel =
  | "CIMB" | "GCASH" | "MARIBANK" | "MAYA" | "RCBC"
  | "RCBC CREDIT" | "CASH" | "WISE" | "RCBC SAVINGS"
  | "LANDBANK" | "UNIONBANK";

/** A payment channel / account. Built-ins are known literals; custom accounts
 *  (added in Settings) are any other string. The `& {}` keeps literal
 *  autocomplete while still accepting arbitrary custom names. */
export type Channel = BuiltinChannel | (string & {});

export type LineStatus = "" | "PAID" | "RECEIVED" | "TRANSFERRED" | "SENT";

/** A custom account or a number/color override for a built-in, stored in Firestore. */
export interface Account {
  id: string;
  name: string;
  number?: string;
  color?: string; // palette key (custom accounts only); built-ins use their fixed chip
}

export interface TemplateLine {
  id: string;
  name: string;
  amount: number;
  channel: Channel;
  cutoff: 1 | 2;
  order: number;
  debtId?: string;
  isEnvelope?: boolean; // Quick Add spending can draw from this line instead of free cash
  budgetGroup?: string; // envelope lines sharing a group name form ONE combined budget ("" ≡ none)
}

export interface MonthLine extends TemplateLine {
  status: LineStatus;
  paidDate?: string; // ISO date
  oneOff: boolean;
  overridden?: boolean; // inline-edited for this month; template sync must not clobber it
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  day: number; // 13 | 25 | 29
  cutoff: 1 | 2;
}

export interface Debt {
  id: string;
  name: string;
  startingBalance: number;
  currentBalance: number;
  dueDay?: number;
  statementDay?: number; // credit cards: day the statement cuts; enables cycle tracking
  minimum?: number;
  creditLimit?: number; // for credit cards — remaining credit = creditLimit − currentBalance
  payoffOrder: number;
  channel: Channel;
  isBNPL: boolean;
  active: boolean;
}

/** One credit-card statement cycle, stored at debts/{id}/cycles/{YYYY-MM}
 *  (key = the statement's month). */
export interface DebtCycle {
  id: string;              // "YYYY-MM" cycle key
  debtId?: string;         // injected by useCollectionGroup
  statementDate: string;   // "YYYY-MM-DD"
  dueDate: string;         // "YYYY-MM-DD"
  statementBalance: number;
  minimumDue: number;
}

export interface EventItem {
  id: string;
  name: string;
  amount: number;
  month: string; // "YYYY-MM"
  cutoff?: 1 | 2; // which cutoff the one-off lands in; defaults to 2
  channel?: Channel;
  note?: string;
}

export interface SinkingFund {
  id: string;
  name: string;
  monthlyDeposit: number;
  releaseMonths: number[]; // e.g. [3, 6, 9, 12]
  balance: number;
}

export interface Category { id: string; name: string; order: number; budget?: number }

/** An individually-tracked recurring service (Netflix, iCloud, …). Informational
 *  registry only — does not create month lines or affect money math. */
export interface Subscription {
  id: string;
  name: string;
  amount: number;
  channel?: Channel;
  note?: string;
}

export interface Meta {
  savingsBalance: number;
  savingsFloor: number;
  currency: string;
  incomeChannel?: string; // account where salary lands; netted out of the send calculator
}
