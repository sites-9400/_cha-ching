import type { LineGroup, TemplateLine } from "./types";

export const LINE_GROUPS: { key: LineGroup; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "family", label: "Family" },
  { key: "allowance", label: "Allowance" },
  { key: "cards", label: "Cards & debts" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "health", label: "Health" },
  { key: "giving", label: "Giving" },
  { key: "school", label: "School" },
  { key: "travel", label: "Travel" },
  { key: "savings", label: "Savings" },
  { key: "other", label: "Other" },
];

export function groupLabel(key: LineGroup): string {
  return LINE_GROUPS.find((g) => g.key === key)?.label ?? "Other";
}

const isValid = (g: unknown): g is LineGroup => LINE_GROUPS.some((x) => x.key === g);

/** Which group a line counts under. Debt links always win; then an explicit
 *  valid group; then name/budget heuristics; else "other". Pure. */
export function resolveGroup(
  line: Pick<TemplateLine, "name" | "debtId" | "debtSplits" | "group" | "isEnvelope" | "budgetGroup">,
): LineGroup {
  if (line.debtId || (line.debtSplits && line.debtSplits.length > 0)) return "cards";
  if (isValid(line.group)) return line.group;
  if (/saving/i.test(line.name)) return "savings";
  if (line.isEnvelope || (line.budgetGroup && line.budgetGroup !== "")) return "allowance";
  return "other";
}
