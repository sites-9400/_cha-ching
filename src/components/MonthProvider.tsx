import { createContext, useContext, useEffect, useRef } from "react";
import { currentMonthKey } from "../lib/clock";
import { eventsCol, monthDoc, monthLines, templateIncomes, templateLines } from "../lib/paths";
import { writeMonth } from "../lib/repo";
import { generateMonthLines } from "../lib/selectors";
import type { EventItem, Income, MonthLine, TemplateLine } from "../lib/types";
import { useCollection } from "../hooks/useCollection";
import { useDoc } from "../hooks/useDoc";

interface MonthCtx {
  monthKey: string;
  lines: MonthLine[];
  incomes: Income[];
  ready: boolean;
}
const Ctx = createContext<MonthCtx | null>(null);
export const useMonth = (): MonthCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMonth outside MonthProvider");
  return v;
};

export default function MonthProvider({ children }: { children: React.ReactNode }) {
  const monthKey = currentMonthKey();
  const monthMeta = useDoc<{ id: string }>(monthDoc(monthKey));
  const lines = useCollection<MonthLine>(monthLines(monthKey));
  const incomes = useCollection<Income>(templateIncomes());
  const template = useCollection<TemplateLine>(templateLines());
  const events = useCollection<EventItem>(eventsCol());
  const startedRef = useRef(false);

  useEffect(() => {
    // monthMeta === null means the doc doesn't exist yet → generate it once.
    if (monthMeta === null && !startedRef.current && template.length > 0 && incomes.length > 0) {
      startedRef.current = true;
      const generated = generateMonthLines(template, events, monthKey);
      void writeMonth(monthKey, generated, incomes).catch(() => {
        startedRef.current = false;
      });
    }
  }, [monthMeta, template, events, incomes, monthKey]);

  const ready = monthMeta !== undefined && !(monthMeta === null) && lines.length > 0;
  return (
    <Ctx.Provider value={{ monthKey, lines, incomes, ready }}>{children}</Ctx.Provider>
  );
}
