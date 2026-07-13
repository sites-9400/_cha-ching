import { describe, expect, it } from "vitest";
import { mergeAccounts } from "./accounts";
import type { Account } from "./types";

describe("mergeAccounts", () => {
  it("lists built-ins first with baked default numbers", () => {
    const merged = mergeAccounts([]);
    const rcbc = merged.find((a) => a.name === "RCBC")!;
    expect(rcbc).toMatchObject({ number: "9048170868", custom: false });
    const landbank = merged.find((a) => a.name === "LANDBANK")!;
    expect(landbank.number).toBe("3017054634");
  });

  it("lets a Firestore doc override a built-in's number", () => {
    const custom: Account[] = [{ id: "d1", name: "RCBC", number: "9999999999" }];
    const rcbc = mergeAccounts(custom).find((a) => a.name === "RCBC")!;
    expect(rcbc.number).toBe("9999999999");
    expect(rcbc.custom).toBe(false);
    expect(rcbc.docId).toBe("d1");
  });

  it("appends a custom account with its palette chip", () => {
    const custom: Account[] = [{ id: "d2", name: "SEABANK", number: "12345", color: "purple" }];
    const merged = mergeAccounts(custom);
    const sea = merged.find((a) => a.name === "SEABANK")!;
    expect(sea).toMatchObject({ number: "12345", custom: true, docId: "d2" });
    expect(sea.chip).toBe("bg-purple-700 text-purple-50");
    // custom accounts come after all built-ins
    expect(merged[merged.length - 1].name).toBe("SEABANK");
  });
});
