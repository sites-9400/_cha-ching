import { describe, expect, it, vi } from "vitest";

// Debts.tsx pulls in firebase-backed modules; stub them so the pure helpers load in node.
vi.mock("../hooks/useCollection", () => ({ useCollection: () => [] }));
vi.mock("../hooks/useCollectionGroup", () => ({ useCollectionGroup: () => [] }));
vi.mock("../lib/repo", () => ({
  logDebtPayment: vi.fn(), setDebtCycle: vi.fn(), setDebtMinimum: vi.fn(), undoDebtPayment: vi.fn(), updateDebt: vi.fn(),
}));

import { parseBalanceInput, saveBalanceEdit } from "./Debts";

describe("inline balance edit", () => {
  it("parses and rounds to 2dp", () => {
    expect(parseBalanceInput("1234.567")).toBe(1234.57);
    expect(parseBalanceInput("0")).toBe(0);
  });
  it("rejects empty, NaN, negative", () => {
    expect(parseBalanceInput("")).toBeNull();
    expect(parseBalanceInput("abc")).toBeNull();
    expect(parseBalanceInput("-5")).toBeNull();
  });
  it("save calls update with only currentBalance and closes", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const closed = await saveBalanceEdit("d1", "5000.5", update, vi.fn());
    expect(closed).toBe(true);
    expect(update).toHaveBeenCalledWith("d1", { currentBalance: 5000.5 });
  });
  it("negative value does not call update and keeps editing", async () => {
    const update = vi.fn();
    const closed = await saveBalanceEdit("d1", "-1", update, vi.fn());
    expect(closed).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
  it("write failure toasts and still closes", async () => {
    const update = vi.fn().mockRejectedValue(new Error("x"));
    const onError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveBalanceEdit("d1", "10", update, onError)).toBe(false);
    expect(onError).toHaveBeenCalled();
  });
});
