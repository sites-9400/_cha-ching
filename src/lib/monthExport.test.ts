import { describe, expect, it } from "vitest";
import { monthExportRows, type ExportPayment } from "./monthExport";
import type { Debt, MonthLine } from "./types";

const M = (o: Partial<MonthLine>): MonthLine =>
  ({ id: "l", name: "Line", amount: 0, channel: "CIMB", cutoff: 1, order: 0, status: "", oneOff: false, ...o });
const P = (o: Partial<ExportPayment>): ExportPayment =>
  ({ debtId: "d1", amount: 0, monthKey: "2026-07", cutoff: 1, ...o });
const D = (o: Partial<Debt>): Debt =>
  ({ id: "d1", name: "RCBC Credit", startingBalance: 0, currentBalance: 0, payoffOrder: 1,
     channel: "RCBC CREDIT", isBNPL: false, active: true, ...o });

describe("monthExportRows", () => {
  it("maps a month line to a row with every column filled", () => {
    const rows = monthExportRows(
      [M({ name: "Rent", amount: 15000, channel: "CIMB", cutoff: 1, status: "PAID" })],
      [], [], "2026-07",
    );
    expect(rows).toEqual([{
      cutoff: 1, name: "Rent", amount: 15000, channel: "CIMB",
      status: "PAID", type: "recurring", paysDebt: "",
    }]);
  });

  it("types a one-off line as one-off", () => {
    const rows = monthExportRows([M({ name: "Birthday gift", oneOff: true })], [], [], "2026-07");
    expect(rows[0].type).toBe("one-off");
  });

  it("resolves a line's debtId to the debt name in Pays debt", () => {
    const rows = monthExportRows(
      [M({ name: "RCBC card", debtId: "d1" })], [], [D({ id: "d1", name: "RCBC Credit" })], "2026-07",
    );
    expect(rows[0].paysDebt).toBe("RCBC Credit");
  });

  it("leaves Pays debt blank when the debt was deleted", () => {
    const rows = monthExportRows([M({ debtId: "gone" })], [], [], "2026-07");
    expect(rows[0].paysDebt).toBe("");
  });

  it("excludes a payment that came from ticking a line (has lineId)", () => {
    const rows = monthExportRows(
      [M({ id: "a", name: "RCBC card", amount: 4000, debtId: "d1" })],
      [P({ debtId: "d1", amount: 4000, lineId: "a" })],
      [D({})], "2026-07",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("RCBC card");
  });

  it("includes a Debt Plan payment (no lineId) as a debt-payment row", () => {
    const rows = monthExportRows(
      [], [P({ debtId: "d1", amount: 2500, cutoff: 2 })],
      [D({ id: "d1", name: "Home Credit", channel: "CIMB" })], "2026-07",
    );
    expect(rows).toEqual([{
      cutoff: 2, name: "Extra payment", amount: 2500, channel: "CIMB",
      status: "PAID", type: "debt-payment", paysDebt: "Home Credit",
    }]);
  });

  it("labels a payment whose debt was deleted rather than dropping it", () => {
    const rows = monthExportRows([], [P({ debtId: "gone", amount: 900 })], [], "2026-07");
    expect(rows[0]).toMatchObject({ name: "Extra payment", amount: 900, paysDebt: "Unknown debt", channel: "" });
  });

  it("excludes payments belonging to another month", () => {
    const rows = monthExportRows([], [P({ monthKey: "2026-06", amount: 999 })], [D({})], "2026-07");
    expect(rows).toEqual([]);
  });

  it("sorts by cutoff, lines before debt payments within a cutoff", () => {
    const rows = monthExportRows(
      [M({ name: "Netflix", cutoff: 2, order: 1 }), M({ name: "Rent", cutoff: 1, order: 2 }),
       M({ name: "Allowance", cutoff: 1, order: 1 })],
      [P({ cutoff: 1, amount: 500 })],
      [D({})], "2026-07",
    );
    expect(rows.map((r) => r.name)).toEqual(["Allowance", "Rent", "Extra payment", "Netflix"]);
  });

  it("returns an empty array for a month with nothing in it", () => {
    expect(monthExportRows([], [], [], "2026-07")).toEqual([]);
  });
});
