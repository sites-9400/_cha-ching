import { useEffect, useRef, useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { currentMonthKey, localIso } from "../lib/clock";
import { parseTransactions, type ParsedTxn } from "../lib/importParse";
import { decodePaidFrom } from "../lib/paidFrom";
import { categoriesCol, debtsCol, expensesCol, monthLines } from "../lib/paths";
import { addExpense } from "../lib/repo";
import { activeLines } from "../lib/selectors";
import { showToast } from "../lib/toast";
import type { Category, Debt, Expense, MonthLine } from "../lib/types";
import PaidFromPicker from "./PaidFromPicker";

type Phase = "pick" | "ocr" | "review";

interface ReviewRow extends ParsedTxn {
  include: boolean;
  duplicate: boolean;
}

const LAST_PAIDFROM_KEY = "import-paidfrom";

/** Full-screen review overlay: pick a bank-app screenshot, OCR it on device
 *  with tesseract.js, then review/edit the parsed rows before adding them as
 *  expenses. Self-loads categories, this month's activeLines (for envelopes +
 *  groups), debts, and expenses (for duplicate detection) — mirrors how
 *  SpendingCalendar self-loads its collections. */
export default function ImportExpenses({ onClose }: { onClose: () => void }) {
  const categories = useCollection<Category>(categoriesCol());
  const expenses = useCollection<Expense>(expensesCol());
  const allLines = useCollection<MonthLine>(monthLines(currentMonthKey()));
  const lines = activeLines(allLines);
  const debts = useCollection<Debt>(debtsCol());
  const activeDebts = debts.filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);

  const cats = [...categories].sort((a, b) => a.order - b.order);
  const envelopes = lines
    .filter((l) => l.isEnvelope && !l.budgetGroup)
    .sort((a, b) => a.cutoff - b.cutoff || a.order - b.order);
  const groups = [...new Set(lines.filter((l) => l.isEnvelope && l.budgetGroup).map((l) => l.budgetGroup!))].sort();

  const [phase, setPhase] = useState<Phase>("pick");
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [category, setCategory] = useState("");
  const [paidFrom, setPaidFrom] = useState(() => localStorage.getItem(LAST_PAIDFROM_KEY) ?? "");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Categories load async (Firestore snapshot) — default to the first once available.
  useEffect(() => {
    if (!category && cats.length > 0) setCategory(cats[0].name);
  }, [cats, category]);

  function pickPaidFrom(token: string) {
    setPaidFrom(token);
    localStorage.setItem(LAST_PAIDFROM_KEY, token);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setPhase("ocr");
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m) => m.status === "recognizing text" && setProgress(m.progress),
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const today = localIso().slice(0, 10);
      const parsed = parseTransactions(data.text);
      const reviewRows: ReviewRow[] = parsed.map((p) => {
        const date = p.date ?? today;
        const duplicate = expenses.some((exp) => exp.amount === p.amount && exp.date.slice(0, 10) === date);
        return { ...p, date, include: !p.credit && !duplicate, duplicate };
      });
      setRows(reviewRows);
      setPhase("review");
    } catch (err) {
      console.error(err);
      showToast("Couldn't read the image — try a clearer screenshot");
      setPhase("pick");
    }
  }

  function updateRow(i: number, patch: Partial<ReviewRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const includedCount = rows.filter((r) => r.include).length;

  function addAll() {
    const funding = decodePaidFrom(paidFrom);
    const debt = paidFrom.startsWith("@debt:") ? activeDebts.find((d) => d.id === paidFrom.slice(6)) : undefined;
    const channel = debt ? debt.channel : "CASH";
    const included = rows.filter((r) => r.include);
    for (const row of included) {
      void addExpense({
        amount: row.amount,
        category,
        channel,
        note: row.note,
        date: `${row.date}T12:00:00`,
        ...funding,
      }).catch((err) => {
        console.error(err);
        showToast("Expense didn't save — check connection");
      });
    }
    showToast(`Imported ${included.length} expenses`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] p-5 flex flex-col gap-3 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Import from screenshot</h3>
          <button onClick={onClose} className="text-stone-400 text-sm">Cancel</button>
        </div>

        {phase === "pick" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-stone-500 text-center">
              Upload a bank-app "Recent Transactions" screenshot. Processing happens on your device — no bank data leaves your phone.
            </p>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="text-sm" />
          </div>
        )}

        {phase === "ocr" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-stone-500">Reading screenshot…</p>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}

        {phase === "review" && (
          <>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Category</p>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <button
                    key={c.id} onClick={() => setCategory(c.name)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                      category === c.name ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
                    }`}
                  >{c.name}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Paid from</p>
              <PaidFromPicker value={paidFrom} onPick={pickPaidFrom} groups={groups} envelopes={envelopes} debts={activeDebts} />
            </div>

            <ul className="flex flex-col gap-2">
              {rows.map((row, i) => (
                <li key={i} className="flex items-center gap-1.5 bg-stone-50 rounded-xl px-2.5 py-2">
                  <input
                    type="checkbox" checked={row.include}
                    onChange={(e) => updateRow(i, { include: e.target.checked })}
                    className="shrink-0"
                  />
                  <input
                    type="date" value={row.date ?? ""}
                    onChange={(e) => updateRow(i, { date: e.target.value })}
                    className="text-xs bg-white rounded-lg px-1.5 py-1 w-[8.25rem] shrink-0 outline-none"
                  />
                  <input
                    value={row.note} placeholder="merchant"
                    onChange={(e) => updateRow(i, { note: e.target.value })}
                    className="text-xs flex-1 min-w-0 bg-white rounded-lg px-1.5 py-1 outline-none"
                  />
                  <input
                    type="number" inputMode="decimal" value={row.amount}
                    onChange={(e) => updateRow(i, { amount: Number(e.target.value) })}
                    className="text-xs w-16 shrink-0 bg-white rounded-lg px-1.5 py-1 outline-none tabular-nums"
                  />
                  {row.credit && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">credit</span>
                  )}
                  {row.duplicate && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">dup?</span>
                  )}
                </li>
              ))}
              {rows.length === 0 && <li className="text-sm text-stone-400 px-1">No transactions found in this screenshot.</li>}
            </ul>

            <button
              onClick={addAll} disabled={includedCount === 0}
              className="bg-emerald-600 disabled:bg-stone-300 text-white font-semibold rounded-xl py-3 text-sm mt-1"
            >Add {includedCount} expenses</button>
          </>
        )}
      </div>
    </div>
  );
}
