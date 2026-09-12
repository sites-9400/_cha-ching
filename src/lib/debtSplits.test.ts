import { describe, expect, it } from "vitest";
import { linkedDebtIds, paymentsForLine, splitsRemainder } from "./debtSplits";
import type { DebtSplit } from "./types";

describe("paymentsForLine", () => {
  it("prefers debtSplits over debtId when splits are present", () => {
    const line = { amount: 1000, debtId: "single", debtSplits: [{ debtId: "a", amount: 400 }, { debtId: "b", amount: 600 }] };
    expect(paymentsForLine(line)).toEqual([{ debtId: "a", amount: 400 }, { debtId: "b", amount: 600 }]);
  });

  it("returns a copy of the splits, not the original array", () => {
    const splits: DebtSplit[] = [{ debtId: "a", amount: 400 }];
    const line = { amount: 400, debtSplits: splits };
    const result = paymentsForLine(line);
    expect(result).not.toBe(splits);
    expect(result).toEqual(splits);
  });

  it("filters out splits with a blank debtId or non-positive amount", () => {
    const line = {
      amount: 1000,
      debtSplits: [
        { debtId: "a", amount: 400 },
        { debtId: "", amount: 300 },
        { debtId: "b", amount: 0 },
        { debtId: "c", amount: -50 },
      ],
    };
    expect(paymentsForLine(line)).toEqual([{ debtId: "a", amount: 400 }]);
  });

  it("falls back to a single debtId payment when there are no splits", () => {
    const line = { amount: 500, debtId: "revi" };
    expect(paymentsForLine(line)).toEqual([{ debtId: "revi", amount: 500 }]);
  });

  it("falls back to a single debtId payment when debtSplits is an empty array", () => {
    const line = { amount: 500, debtId: "revi", debtSplits: [] };
    expect(paymentsForLine(line)).toEqual([{ debtId: "revi", amount: 500 }]);
  });

  it("returns an empty array when there is neither debtId nor debtSplits", () => {
    const line = { amount: 500 };
    expect(paymentsForLine(line)).toEqual([]);
  });
});

describe("splitsRemainder", () => {
  it("computes the unallocated amount", () => {
    expect(splitsRemainder(1000, [{ debtId: "a", amount: 400 }])).toBe(600);
  });

  it("rounds to 2 decimal places against float drift", () => {
    const splits: DebtSplit[] = [
      { debtId: "bizfuse-919", amount: 918.92 },
      { debtId: "instacash-1453", amount: 1453.33 },
      { debtId: "facility-3516", amount: 3515.67 },
      { debtId: "bizfuse-4805", amount: 4805.33 },
    ];
    expect(splitsRemainder(10693.25, splits)).toBe(0);
  });

  it("is zero when there are no splits and no amount", () => {
    expect(splitsRemainder(0, [])).toBe(0);
  });
});

describe("linkedDebtIds", () => {
  it("returns distinct debtIds from splits", () => {
    const line = { amount: 100, debtSplits: [{ debtId: "a", amount: 50 }, { debtId: "a", amount: 50 }, { debtId: "b", amount: 0 }] };
    expect(linkedDebtIds(line)).toEqual(["a"]);
  });

  it("returns the single debtId when there are no splits", () => {
    const line = { amount: 100, debtId: "revi" };
    expect(linkedDebtIds(line)).toEqual(["revi"]);
  });

  it("returns an empty array when there is nothing linked", () => {
    expect(linkedDebtIds({ amount: 100 })).toEqual([]);
  });
});
