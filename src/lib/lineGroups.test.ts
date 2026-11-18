import { describe, expect, it } from "vitest";
import { LINE_GROUPS, groupLabel, resolveGroup } from "./lineGroups";
import type { LineGroup } from "./types";

const l = (o: Partial<Parameters<typeof resolveGroup>[0]> = {}) => ({ name: "Thing", ...o });

describe("resolveGroup", () => {
  it("debt link always wins, even over an explicit group or savings name", () => {
    expect(resolveGroup(l({ debtId: "d1", group: "home" }))).toBe("cards");
    expect(resolveGroup(l({ name: "Savings loan", debtSplits: [{ debtId: "d", amount: 1 }], group: "giving" }))).toBe("cards");
  });
  it("explicit valid group beats heuristics", () => {
    expect(resolveGroup(l({ name: "Savings", group: "home", isEnvelope: true }))).toBe("home");
  });
  it("invalid explicit group falls through", () => {
    expect(resolveGroup(l({ group: "bogus" as unknown as LineGroup }))).toBe("other");
  });
  it("name with saving maps to savings", () => {
    expect(resolveGroup(l({ name: "Emergency savings" }))).toBe("savings");
  });
  it("envelope or budgetGroup maps to allowance; empty budgetGroup does not", () => {
    expect(resolveGroup(l({ isEnvelope: true }))).toBe("allowance");
    expect(resolveGroup(l({ budgetGroup: "Food" }))).toBe("allowance");
    expect(resolveGroup(l({ budgetGroup: "" }))).toBe("other");
  });
  it("empty debtSplits is not a debt link", () => {
    expect(resolveGroup(l({ debtSplits: [] }))).toBe("other");
  });
});

describe("groupLabel", () => {
  it("returns labels in order", () => {
    expect(LINE_GROUPS.map((g) => g.key)).toEqual(
      ["home", "family", "allowance", "cards", "subscriptions", "health", "giving", "school", "travel", "savings", "other"],
    );
    expect(groupLabel("cards")).toBe("Cards & debts");
    expect(groupLabel("savings")).toBe("Savings");
  });
});
