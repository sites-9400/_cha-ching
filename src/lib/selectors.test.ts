import { describe, expect, it } from "vitest";
import { addMonths } from "./format";
import {
  cutoffSummary,
  debtTotals,
  envelopeSpent,
  fundStateFor,
  generateMonthLines,
  isCutoffClosed,
  projectDebtFreeMonth,
  unplannedForCutoff,
} from "./selectors";
import type { Debt, EventItem, Income, MonthLine, SinkingFund, TemplateLine } from "./types";

const mk = (
  name: string,
  amount: number,
  cutoff: 1 | 2,
  status: MonthLine["status"] = "",
): MonthLine => ({
  id: name,
  name,
  amount,
  channel: "CIMB",
  cutoff,
  order: 0,
  status,
  oneOff: false,
});

const incomes: Income[] = [
  { id: "c13", name: "Crunchy 13th", amount: 60600, day: 13, cutoff: 1 },
  { id: "p25", name: "PHP 25th", amount: 51000, day: 25, cutoff: 2 },
  { id: "c29", name: "Crunchy 29th", amount: 60600, day: 29, cutoff: 2 },
];

// July 1st-cutoff template lines (spec seed data)
const cut1: MonthLine[] = [
  mk("Allowance", 10000, 1, "PAID"),
  mk("Tithes", 5000, 1),
  mk("Subscriptions", 2277, 1),
  mk("Gemini", 167, 1),
  mk("Shopping Fund", 2000, 1),
];

describe("cutoffSummary", () => {
  it("computes income, planned, ticked and surplus for cutoff 1", () => {
    const s = cutoffSummary(cut1, incomes, 1);
    expect(s.income).toBe(60600);
    expect(s.planned).toBe(19444);
    expect(s.ticked).toBe(10000); // only Allowance is PAID
    expect(s.surplus).toBe(60600 - 19444); // 41156
  });

  it("cutoff 2 income combines both paydays", () => {
    const s = cutoffSummary([], incomes, 2);
    expect(s.income).toBe(111600);
    expect(s.surplus).toBe(111600);
  });
});

const debts: Debt[] = [
  { id: "revi", name: "REVI", startingBalance: 17265, currentBalance: 17265, payoffOrder: 1, channel: "CIMB", isBNPL: false, active: true },
  { id: "classic", name: "RCBC Classic", startingBalance: 6337, currentBalance: 6337, payoffOrder: 2, channel: "RCBC", isBNPL: false, active: true },
  { id: "gold", name: "RCBC Gold", startingBalance: 44871, currentBalance: 44871, payoffOrder: 3, channel: "RCBC", isBNPL: false, active: true },
  { id: "landers", name: "Landers", startingBalance: 49923, currentBalance: 49923, payoffOrder: 4, channel: "MAYA", isBNPL: false, active: true },
  { id: "ew", name: "EastWest", startingBalance: 98824, currentBalance: 98824, payoffOrder: 5, channel: "MARIBANK", isBNPL: false, active: true },
  { id: "laptop", name: "EW Laptop", startingBalance: 51995, currentBalance: 51995, payoffOrder: 6, channel: "MARIBANK", isBNPL: true, active: true },
];

describe("debtTotals", () => {
  it("separates blitz debt (excl BNPL) from total", () => {
    const t = debtTotals(debts);
    expect(t.total).toBe(269215);
    expect(t.blitz).toBe(217220);
  });
});

describe("projectDebtFreeMonth", () => {
  it("divides blitz debt by monthly paydown, ceiling", () => {
    // 217220 / 90164 = 2.41 → 3 months from July → paydowns land Jul, Aug, Sep
    expect(projectDebtFreeMonth(debts, 90164, "2026-07")).toBe("2026-09");
  });
  it("returns fromMonth when no blitz debt remains", () => {
    const clear = debts.map((d) => (d.isBNPL ? d : { ...d, currentBalance: 0 }));
    expect(projectDebtFreeMonth(clear, 90164, "2026-07")).toBe("2026-07");
  });
});

describe("generateMonthLines", () => {
  const template: TemplateLine[] = [
    { id: "t1", name: "Rent", amount: 10000, channel: "RCBC", cutoff: 2, order: 1 },
  ];
  const events: EventItem[] = [
    { id: "e1", name: "Iloilo trip", amount: 20000, month: "2026-08" },
    { id: "e2", name: "Mama bday", amount: 5000, month: "2026-09" },
  ];
  it("copies template with blank status and appends the month's events as one-offs", () => {
    const lines = generateMonthLines(template, events, "2026-08");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ name: "Rent", status: "", oneOff: false });
    expect(lines[1]).toMatchObject({ name: "Iloilo trip", amount: 20000, oneOff: true, cutoff: 2 });
  });
  it("excludes events from other months", () => {
    const lines = generateMonthLines(template, events, "2026-09");
    expect(lines.map((l) => l.name)).toEqual(["Rent", "Mama bday"]);
  });
  it("honors an event's chosen cutoff, defaulting to 2 when unset", () => {
    const evs: EventItem[] = [
      { id: "c1", name: "Payday bonus spend", amount: 3000, month: "2026-08", cutoff: 1 },
      { id: "c2", name: "Rent-week trip", amount: 4000, month: "2026-08" }, // no cutoff → 2
    ];
    const lines = generateMonthLines([], evs, "2026-08");
    expect(lines.find((l) => l.name === "Payday bonus spend")).toMatchObject({ cutoff: 1 });
    expect(lines.find((l) => l.name === "Rent-week trip")).toMatchObject({ cutoff: 2 });
  });
});

describe("fundStateFor", () => {
  const fund: SinkingFund = {
    id: "shop",
    name: "Shopping",
    monthlyDeposit: 2000,
    releaseMonths: [3, 6, 9, 12],
    balance: 0,
  };
  it("deposits monthly and releases full balance on release months", () => {
    // Jul(7): +2000→2000 · Aug(8): +2000→4000 · Sep(9): release 6000→0
    expect(fundStateFor(fund, 7)).toMatchObject({ deposit: 2000, release: 0 });
    const sep = fundStateFor({ ...fund, balance: 4000 }, 9);
    expect(sep).toMatchObject({ deposit: 2000, release: 6000, balanceAfter: 0 });
  });
});

describe("addMonths", () => {
  it("crosses year boundaries", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });
});

describe("isCutoffClosed", () => {
  it("is false for a cutoff with no lines", () => {
    expect(isCutoffClosed([], 1)).toBe(false);
  });
  it("is false while any line is unticked", () => {
    expect(isCutoffClosed([mk("a", 100, 1, "PAID"), mk("b", 100, 1)], 1)).toBe(false);
  });
  it("is true when every line is ticked (any non-blank status)", () => {
    expect(
      isCutoffClosed([mk("a", 100, 1, "PAID"), mk("b", 100, 1, "SENT"), mk("c", 100, 1, "TRANSFERRED")], 1),
    ).toBe(true);
  });
  it("ignores the other cutoff's lines", () => {
    const lines = [mk("a", 100, 1, "PAID"), mk("b", 100, 2)];
    expect(isCutoffClosed(lines, 1)).toBe(true);
    expect(isCutoffClosed(lines, 2)).toBe(false);
  });
});

const env = (id: string, cutoff: 1 | 2, amount: number, status: MonthLine["status"] = ""): MonthLine =>
  ({ ...mk(id, amount, cutoff, status), isEnvelope: true });
const exp = (amount: number, date: string, envelopeLineId?: string) =>
  ({ amount, date, ...(envelopeLineId ? { envelopeLineId } : {}) });

describe("envelopeSpent", () => {
  it("sums only this month's expenses linked to the line", () => {
    const expenses = [
      exp(100, "2026-07-05T10:00:00.000Z", "allow"),
      exp(50, "2026-07-20T10:00:00.000Z", "allow"),
      exp(999, "2026-06-30T10:00:00.000Z", "allow"), // other month
      exp(70, "2026-07-06T10:00:00.000Z", "other"),  // other envelope
      exp(40, "2026-07-07T10:00:00.000Z"),           // unplanned
    ];
    expect(envelopeSpent(expenses, "2026-07", "allow")).toBe(150);
  });
});

describe("unplannedForCutoff", () => {
  const openLines = [env("allow", 1, 1000), mk("rent", 100, 2)];

  it("attributes envelope-less expenses by day rule when cutoffs are open", () => {
    const expenses = [
      exp(100, "2026-07-15T10:00:00.000Z"), // day 15 → cutoff 1
      exp(200, "2026-07-28T10:00:00.000Z"), // day 28 → cutoff 2
      exp(300, "2026-07-05T10:00:00.000Z"), // day 5  → cutoff 2
    ];
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(100);
    expect(unplannedForCutoff(expenses, "2026-07", 2, openLines)).toBe(500);
  });

  it("excludes envelope-linked expenses from unplanned", () => {
    const expenses = [exp(100, "2026-07-15T10:00:00.000Z", "allow")];
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(0);
  });

  it("counts only the envelope's overspend excess, in the envelope's cutoff", () => {
    const expenses = [
      exp(900, "2026-07-15T10:00:00.000Z", "allow"),
      exp(400, "2026-07-16T10:00:00.000Z", "allow"),
    ];
    // spent 1300 of 1000 → 300 excess charged to cutoff 1
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(300);
    expect(unplannedForCutoff(expenses, "2026-07", 2, openLines)).toBe(0);
  });

  it("treats an orphaned envelopeLineId as unplanned", () => {
    const expenses = [exp(100, "2026-07-15T10:00:00.000Z", "deleted-line")];
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(100);
  });

  it("rolls date-attributed expenses off a closed cutoff onto the open one", () => {
    const lines = [mk("a", 100, 1, "PAID"), mk("b", 100, 2)];
    const expenses = [exp(100, "2026-07-15T10:00:00.000Z")]; // day 15 → cutoff 1, but 1 is closed
    expect(unplannedForCutoff(expenses, "2026-07", 1, lines)).toBe(0);
    expect(unplannedForCutoff(expenses, "2026-07", 2, lines)).toBe(100);
  });

  it("reduces nothing when both cutoffs are closed (tracking-only)", () => {
    const lines = [mk("a", 100, 1, "PAID"), mk("b", 100, 2, "SENT")];
    const expenses = [exp(100, "2026-07-15T10:00:00.000Z")];
    expect(unplannedForCutoff(expenses, "2026-07", 1, lines)).toBe(0);
    expect(unplannedForCutoff(expenses, "2026-07", 2, lines)).toBe(0);
  });

  it("ignores other months", () => {
    expect(unplannedForCutoff([exp(100, "2026-06-15T10:00:00.000Z")], "2026-07", 1, openLines)).toBe(0);
  });
});
