import { describe, expect, it } from "vitest";
import {
  categoriesCol, debtPayments, debtsCol, eventsCol, expensesCol, fundsCol,
  metaDoc, monthDoc, monthLines, templateIncomes, templateLines,
} from "./paths";

describe("paths", () => {
  it("builds household-scoped collection paths", () => {
    expect(templateLines()).toBe("households/main/template-lines");
    expect(templateIncomes()).toBe("households/main/template-incomes");
    expect(debtsCol()).toBe("households/main/debts");
    expect(eventsCol()).toBe("households/main/events");
    expect(fundsCol()).toBe("households/main/sinkingFunds");
    expect(categoriesCol()).toBe("households/main/categories");
    expect(expensesCol()).toBe("households/main/expenses");
  });
  it("builds month + nested paths", () => {
    expect(monthDoc("2026-07")).toBe("households/main/months/2026-07");
    expect(monthLines("2026-07")).toBe("households/main/months/2026-07/lines");
    expect(debtPayments("revi")).toBe("households/main/debts/revi/payments");
  });
  it("builds the meta doc path", () => {
    expect(metaDoc()).toBe("households/main");
  });
});
