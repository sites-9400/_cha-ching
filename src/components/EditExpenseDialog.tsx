import { useState } from "react";
import { updateExpense, type ExpenseInput } from "../lib/repo";
import type { Category, Channel, MonthLine } from "../lib/types";
import { useAccounts } from "./AccountsProvider";

interface Expense extends ExpenseInput { id: string }

/** Edit a logged expense: amount, category, account, envelope, note, date.
 *  Styled to match EditLineDialog. */
export default function EditExpenseDialog(
  { expense, categories, lines, onClose }:
  { expense: Expense; categories: Category[]; lines: MonthLine[]; onClose: () => void },
) {
  const { names: CHANNELS, chip } = useAccounts();
  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState(expense.category);
  const [channel, setChannel] = useState<Channel>(expense.channel);
  // "@savings" = paid from savings; "@group:X" = budget group X.
  const [envelope, setEnvelope] = useState(
    expense.fundedBySavings ? "@savings"
    : expense.budgetGroup ? `@group:${expense.budgetGroup}`
    : (expense.envelopeLineId ?? ""),
  );
  const [note, setNote] = useState(expense.note);
  const [date, setDate] = useState(expense.date.slice(0, 10));

  const cats = [...categories].sort((a, b) => a.order - b.order);
  const envelopes = lines
    .filter((l) => l.isEnvelope && !l.budgetGroup)
    .sort((a, b) => a.cutoff - b.cutoff || a.order - b.order);
  const groups = [...new Set(lines.filter((l) => l.isEnvelope && l.budgetGroup).map((l) => l.budgetGroup!))].sort();

  const amt = Number(amount);
  const valid = amt > 0 && date !== "";

  async function save() {
    if (!valid) return;
    const patch: Partial<Omit<ExpenseInput, "envelopeLineId" | "fundedBySavings" | "budgetGroup">>
      & { envelopeLineId?: string | null; fundedBySavings?: boolean | null; budgetGroup?: string | null } = {};
    if (amt !== expense.amount) patch.amount = amt;
    if (category !== expense.category) patch.category = category;
    if (channel !== expense.channel) patch.channel = channel;
    if (note !== expense.note) patch.note = note;
    if (date !== expense.date.slice(0, 10)) patch.date = `${date}${expense.date.slice(10)}`;
    const was = expense.fundedBySavings ? "@savings"
      : expense.budgetGroup ? `@group:${expense.budgetGroup}`
      : (expense.envelopeLineId ?? "");
    if (envelope !== was) {
      patch.fundedBySavings = envelope === "@savings" ? true : null;
      patch.budgetGroup = envelope.startsWith("@group:") ? envelope.slice(7) : null;
      patch.envelopeLineId = envelope && !envelope.startsWith("@") ? envelope : null;
    }
    await updateExpense(expense.id, patch);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">Edit expense</h3>

        <label className="flex items-center justify-between text-sm">Amount
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
        </label>

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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Account</p>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={String(c)} onClick={() => setChannel(c)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  channel === c ? chip(c) : "bg-stone-100 text-stone-400"
                }`}
              >{c}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Paid from</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEnvelope("")}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                envelope === "" ? "bg-stone-700 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >Unplanned</button>
            {groups.map((g) => (
              <button
                key={g} onClick={() => setEnvelope(`@group:${g}`)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  envelope === `@group:${g}` ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >{g}</button>
            ))}
            {envelopes.map((l) => (
              <button
                key={l.id} onClick={() => setEnvelope(l.id)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  envelope === l.id ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >{l.name}</button>
            ))}
            <button
              onClick={() => setEnvelope("@savings")}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                envelope === "@savings" ? "bg-cyan-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >Savings</button>
          </div>
        </div>

        <input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)}
          className="text-sm border-b border-stone-300 outline-none pb-1" />

        <label className="flex items-center justify-between text-sm">Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="text-sm border-b border-stone-300 outline-none" />
        </label>

        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
