import { describe, expect, it } from "vitest";
import { decodePaidFrom, decodePaidFromPatch, encodePaidFrom } from "./paidFrom";

describe("encodePaidFrom", () => {
  it("encodes unplanned as an empty string", () => {
    expect(encodePaidFrom({})).toBe("");
  });
  it("encodes savings-funded as @savings", () => {
    expect(encodePaidFrom({ fundedBySavings: true })).toBe("@savings");
  });
  it("encodes a budget group as @group:X", () => {
    expect(encodePaidFrom({ budgetGroup: "Allowance" })).toBe("@group:Allowance");
  });
  it("encodes a card charge as @debt:ID", () => {
    expect(encodePaidFrom({ paidWithDebtId: "revi" })).toBe("@debt:revi");
  });
  it("encodes an envelope line as its bare id", () => {
    expect(encodePaidFrom({ envelopeLineId: "allow" })).toBe("allow");
  });
  it("prioritizes savings > group > debt > envelope when multiple are set", () => {
    expect(encodePaidFrom({ fundedBySavings: true, budgetGroup: "G", paidWithDebtId: "d", envelopeLineId: "e" }))
      .toBe("@savings");
    expect(encodePaidFrom({ budgetGroup: "G", paidWithDebtId: "d", envelopeLineId: "e" })).toBe("@group:G");
    expect(encodePaidFrom({ paidWithDebtId: "d", envelopeLineId: "e" })).toBe("@debt:d");
  });
});

describe("decodePaidFrom", () => {
  it("decodes '' to no fields (unplanned)", () => {
    expect(decodePaidFrom("")).toEqual({});
  });
  it("decodes @savings to fundedBySavings: true", () => {
    expect(decodePaidFrom("@savings")).toEqual({ fundedBySavings: true });
  });
  it("decodes @group:X to budgetGroup", () => {
    expect(decodePaidFrom("@group:Allowance")).toEqual({ budgetGroup: "Allowance" });
  });
  it("decodes @debt:ID to paidWithDebtId", () => {
    expect(decodePaidFrom("@debt:revi")).toEqual({ paidWithDebtId: "revi" });
  });
  it("decodes a bare id to envelopeLineId", () => {
    expect(decodePaidFrom("allow")).toEqual({ envelopeLineId: "allow" });
  });
});

describe("round-trip: decodePaidFrom(encodePaidFrom(x)) recovers the field", () => {
  it("unplanned", () => {
    expect(decodePaidFrom(encodePaidFrom({}))).toEqual({});
  });
  it("savings", () => {
    expect(decodePaidFrom(encodePaidFrom({ fundedBySavings: true }))).toEqual({ fundedBySavings: true });
  });
  it("group", () => {
    expect(decodePaidFrom(encodePaidFrom({ budgetGroup: "Allowance" }))).toEqual({ budgetGroup: "Allowance" });
  });
  it("debt", () => {
    expect(decodePaidFrom(encodePaidFrom({ paidWithDebtId: "revi" }))).toEqual({ paidWithDebtId: "revi" });
  });
  it("envelope line", () => {
    expect(decodePaidFrom(encodePaidFrom({ envelopeLineId: "allow" }))).toEqual({ envelopeLineId: "allow" });
  });
});

describe("decodePaidFromPatch", () => {
  it("'' nulls every field (unplanned)", () => {
    expect(decodePaidFromPatch("")).toEqual({
      fundedBySavings: null, budgetGroup: null, paidWithDebtId: null, envelopeLineId: null,
    });
  });
  it("@savings sets fundedBySavings true and nulls the rest", () => {
    expect(decodePaidFromPatch("@savings")).toEqual({
      fundedBySavings: true, budgetGroup: null, paidWithDebtId: null, envelopeLineId: null,
    });
  });
  it("@group:X sets budgetGroup and nulls the rest", () => {
    expect(decodePaidFromPatch("@group:Allowance")).toEqual({
      fundedBySavings: null, budgetGroup: "Allowance", paidWithDebtId: null, envelopeLineId: null,
    });
  });
  it("@debt:ID sets paidWithDebtId and nulls the rest", () => {
    expect(decodePaidFromPatch("@debt:revi")).toEqual({
      fundedBySavings: null, budgetGroup: null, paidWithDebtId: "revi", envelopeLineId: null,
    });
  });
  it("a bare id sets envelopeLineId and nulls the rest", () => {
    expect(decodePaidFromPatch("allow")).toEqual({
      fundedBySavings: null, budgetGroup: null, paidWithDebtId: null, envelopeLineId: "allow",
    });
  });
});
