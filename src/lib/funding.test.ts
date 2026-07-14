import { describe, expect, it } from "vitest";
import { cutoffAllocation, fundingByChannel, paidByDebt } from "./funding";
import type { Debt } from "./types";

const D = (o: Partial<Debt>): Debt => ({
  id: o.name ?? "x", name: "x", startingBalance: 0, currentBalance: 0,
  payoffOrder: 0, channel: "RCBC", isBNPL: false, active: true, ...o,
});

const pays = [
  { debtId: "revi", monthKey: "2026-07", cutoff: 1 as const, amount: 5000 },
  { debtId: "revi", monthKey: "2026-07", cutoff: 2 as const, amount: 999 }, // other cutoff
];

describe("paidByDebt", () => {
  it("sums payments for the given month + cutoff only", () => {
    const m = paidByDebt(pays, "2026-07", 1);
    expect(m.get("revi")).toBe(5000);
    expect(paidByDebt(pays, "2026-07", 2).get("revi")).toBe(999);
  });
});

describe("cutoffAllocation", () => {
  it("allocates on start-of-cutoff balances (restores this cutoff's payments)", () => {
    const debts = [D({ id: "revi", name: "REVI", currentBalance: 0, payoffOrder: 1, channel: "CIMB" })];
    const paid = new Map([["revi", 5000]]);
    const alloc = cutoffAllocation(5000, debts, paid, 1);
    expect(alloc.lines[0]).toMatchObject({ debtId: "revi", amount: 5000, kind: "target" });
  });
});

describe("fundingByChannel", () => {
  const lines = [
    { channel: "CIMB", amount: 5000, status: "" },
    { channel: "CIMB", amount: 2000, status: "PAID" },
    { channel: "GCASH", amount: 1500, status: "" },
  ];
  const alloc = [{ channel: "CIMB", amount: 13000 }];

  it("full mode sums bills + debt allocations per channel, sorted desc", () => {
    const out = fundingByChannel(lines, alloc, "full");
    expect(out).toEqual([
      { channel: "CIMB", total: 20000 }, // 5000 + 2000 + 13000
      { channel: "GCASH", total: 1500 },
    ]);
  });

  it("remaining mode skips ticked expense lines (caller supplies the remaining alloc)", () => {
    const out = fundingByChannel(lines, [], "remaining"); // no remaining debt alloc
    expect(out).toEqual([
      { channel: "CIMB", total: 5000 }, // the 2000 PAID line skipped
      { channel: "GCASH", total: 1500 },
    ]);
  });

  it("omits channels that net to zero", () => {
    const out = fundingByChannel([{ channel: "MAYA", amount: 100, status: "PAID" }], [], "remaining");
    expect(out).toEqual([]);
  });

  it("excludes the income channel (salary already lands there)", () => {
    const l = [
      { channel: "WISE", amount: 8000, status: "" }, // income account — skip
      { channel: "CIMB", amount: 3000, status: "" },
    ];
    const out = fundingByChannel(l, [], "full", "WISE");
    expect(out).toEqual([{ channel: "CIMB", total: 3000 }]);
  });
});
