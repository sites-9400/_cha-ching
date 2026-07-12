import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { peso } from "../lib/format";
import { templateIncomes, templateLines } from "../lib/paths";
import { cutoffSummary } from "../lib/selectors";
import type { Income, MonthLine, TemplateLine } from "../lib/types";

const CHIP: Record<string, string> = {
  CIMB: "bg-red-900 text-red-50",
  GCASH: "bg-blue-800 text-blue-50",
  MARIBANK: "bg-orange-300 text-orange-950",
  MAYA: "bg-green-800 text-green-50",
  RCBC: "bg-blue-200 text-blue-950",
  "RCBC CREDIT": "bg-yellow-200 text-yellow-950",
  CASH: "bg-gray-200 text-gray-800",
  "WISE/KLOOK": "bg-emerald-200 text-emerald-950",
  "RCBC SAVINGS": "bg-cyan-200 text-cyan-950",
};

export default function MonthPreview() {
  const [lines, setLines] = useState<TemplateLine[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);

  useEffect(() => {
    const un1 = onSnapshot(query(collection(db, templateLines())), (snap) =>
      setLines(snap.docs.map((d) => d.data() as TemplateLine).sort((a, b) => a.order - b.order)),
    );
    const un2 = onSnapshot(query(collection(db, templateIncomes())), (snap) =>
      setIncomes(snap.docs.map((d) => d.data() as Income)),
    );
    return () => {
      un1();
      un2();
    };
  }, []);

  const asMonthLines = lines.map((l) => ({ ...l, status: "" as const, oneOff: false }));

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900 p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Cha-Ching — Template Preview</h1>
      {[1, 2].map((c) => {
        const cutoff = c as 1 | 2;
        const s = cutoffSummary(asMonthLines, incomes, cutoff);
        return (
          <section key={c} className="mb-6 bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-2">
              {cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}
            </h2>
            <ul className="divide-y divide-stone-100">
              {asMonthLines
                .filter((l) => l.cutoff === cutoff)
                .map((l) => (
                  <li key={l.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-sm">{l.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{peso(l.amount)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CHIP[l.channel]}`}>
                        {l.channel}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-sm flex justify-between font-semibold">
              <span>Income {peso(s.income)}</span>
              <span className="text-emerald-700">Surplus {peso(s.surplus)}</span>
            </p>
          </section>
        );
      })}
    </main>
  );
}
