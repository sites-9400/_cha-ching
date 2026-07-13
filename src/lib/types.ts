export type Channel =
  | "CIMB" | "GCASH" | "MARIBANK" | "MAYA" | "RCBC"
  | "RCBC CREDIT" | "CASH" | "WISE/KLOOK" | "RCBC SAVINGS";

export type LineStatus = "" | "PAID" | "RECEIVED" | "TRANSFERRED" | "SENT";

export interface TemplateLine {
  id: string;
  name: string;
  amount: number;
  channel: Channel;
  cutoff: 1 | 2;
  order: number;
  debtId?: string;
}

export interface MonthLine extends TemplateLine {
  status: LineStatus;
  paidDate?: string; // ISO date
  oneOff: boolean;
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
  minimum?: number;
  payoffOrder: number;
  channel: Channel;
  isBNPL: boolean;
  active: boolean;
}

export interface EventItem {
  id: string;
  name: string;
  amount: number;
  month: string; // "YYYY-MM"
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

export interface Category { id: string; name: string; order: number }

export interface Meta { savingsBalance: number; savingsFloor: number; currency: string }
