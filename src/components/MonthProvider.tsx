import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { currentMonthKey } from "../lib/clock";
import { addMonths } from "../lib/format";
import {
  eventsCol, monthDoc, monthIncomes, monthLines, templateIncomes, templateLines,
} from "../lib/paths";
import { startMonth } from "../lib/repo";
import { generateMonthLines } from "../lib/selectors";
import type { EventItem, Income, MonthLine, TemplateLine } from "../lib/types";
import { useCollection } from "../hooks/useCollection";
import { useDoc } from "../hooks/useDoc";

export type MonthMode = "past" | "current" | "projected" | "started";

interface MonthCtx {
  viewedKey: string;
  currentKey: string;
  mode: MonthMode;
  editable: boolean;
  lines: MonthLine[];
  incomes: Income[];
  ready: boolean;
  goPrev: () => void;
  goNext: () => void;
  start: () => void;
}
const Ctx = createContext<MonthCtx | null>(null);
export const useMonth = (): MonthCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMonth outside MonthProvider");
  return v;
};

export default function MonthProvider({ children }: { children: React.ReactNode }) {
  const currentKey = currentMonthKey();
  const [viewedKey, setViewedKey] = useState(currentKey);

  const template = useCollection<TemplateLine>(templateLines());
  const templateIncomeList = useCollection<Income>(templateIncomes());
  const events = useCollection<EventItem>(eventsCol());

  const monthMeta = useDoc<{ id: string }>(monthDoc(viewedKey));
  const savedLines = useCollection<MonthLine>(monthLines(viewedKey));
  const monthIncomeList = useCollection<Income>(monthIncomes(viewedKey));

  const loadingMeta = monthMeta === undefined;
  const exists = monthMeta !== null && monthMeta !== undefined;

  const mode: MonthMode =
    viewedKey === currentKey ? "current"
    : viewedKey < currentKey ? "past"
    : exists ? "started"
    : "projected";

  const editable = mode === "current" || mode === "started";
  // Projected view = a future month with no doc, or a skipped past month with no doc.
  const isProjected = !loadingMeta && !exists && (mode === "projected" || mode === "past");

  // Reset the generation guard whenever the viewed month changes.
  const startedRef = useRef(false);
  useEffect(() => { startedRef.current = false; }, [viewedKey]);

  // Auto-generate ONLY the current month when missing. startMonth (not raw
  // writeMonth) — it re-checks the meta doc's existence at write time, so a
  // stale/transient `null` snapshot can never overwrite an existing month.
  useEffect(() => {
    if (
      viewedKey === currentKey && monthMeta === null && !startedRef.current &&
      template.length > 0 && templateIncomeList.length > 0
    ) {
      startedRef.current = true;
      void startMonth(currentKey).catch(() => { startedRef.current = false; });
    }
  }, [viewedKey, currentKey, monthMeta, template, events, templateIncomeList]);

  const lines = useMemo<MonthLine[]>(
    () => (isProjected ? generateMonthLines(template, events, viewedKey) : savedLines),
    [isProjected, template, events, viewedKey, savedLines],
  );

  const incomes = useMemo<Income[]>(
    () => (isProjected ? templateIncomeList : [...templateIncomeList, ...monthIncomeList]),
    [isProjected, templateIncomeList, monthIncomeList],
  );

  const ready = isProjected
    ? template.length > 0
    : !loadingMeta && exists && savedLines.length > 0;

  const value: MonthCtx = {
    viewedKey, currentKey, mode, editable, lines, incomes, ready,
    goPrev: () => setViewedKey((k) => addMonths(k, -1)),
    goNext: () => setViewedKey((k) => addMonths(k, 1)),
    start: () => { void startMonth(viewedKey); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
