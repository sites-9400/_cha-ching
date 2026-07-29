import type { ExpenseInput } from "./types";

/** UI token for an expense's funding source: "" = unplanned, "@savings",
 *  "@group:X", "@debt:ID", or a bare month-line id. */
export function encodePaidFrom(
  e: Pick<ExpenseInput, "fundedBySavings" | "budgetGroup" | "paidWithDebtId" | "envelopeLineId">,
): string {
  return e.fundedBySavings ? "@savings"
    : e.budgetGroup ? `@group:${e.budgetGroup}`
    : e.paidWithDebtId ? `@debt:${e.paidWithDebtId}`
    : (e.envelopeLineId ?? "");
}

/** Funding fields implied by a token — exactly one set (or none, unplanned). */
export function decodePaidFrom(token: string): Partial<ExpenseInput> {
  if (token === "@savings") return { fundedBySavings: true };
  if (token.startsWith("@group:")) return { budgetGroup: token.slice(7) };
  if (token.startsWith("@debt:")) return { paidWithDebtId: token.slice(6) };
  return token ? { envelopeLineId: token } : {};
}

/** Patch form for updateExpense: the chosen field set, every other cleared. */
export function decodePaidFromPatch(token: string): {
  fundedBySavings: boolean | null; budgetGroup: string | null;
  paidWithDebtId: string | null; envelopeLineId: string | null;
} {
  return {
    fundedBySavings: token === "@savings" ? true : null,
    budgetGroup: token.startsWith("@group:") ? token.slice(7) : null,
    paidWithDebtId: token.startsWith("@debt:") ? token.slice(6) : null,
    envelopeLineId: token && !token.startsWith("@") ? token : null,
  };
}
