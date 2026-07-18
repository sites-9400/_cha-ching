import { useState } from "react";

/** Enter/edit one statement cycle for a card: statement balance + minimum due. */
export default function StatementDialog({
  debtName, cycleKey, defaultBalance, defaultMin, onConfirm, onCancel,
}: {
  debtName: string; cycleKey: string; defaultBalance: number; defaultMin: number;
  onConfirm: (statementBalance: number, minimumDue: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [balance, setBalance] = useState(defaultBalance ? String(defaultBalance) : "");
  const [min, setMin] = useState(defaultMin ? String(defaultMin) : "");
  const b = Number(balance), m = Number(min);
  const valid = balance !== "" && min !== "" && b >= 0 && m >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">{debtName} · {cycleKey} statement</h3>
        <label className="flex items-center justify-between text-sm">Statement balance
          <input
            type="number" inputMode="decimal" autoFocus value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-28 text-right border-b border-stone-300 outline-none tabular-nums"
          />
        </label>
        <label className="flex items-center justify-between text-sm">Minimum due
          <input
            type="number" inputMode="decimal" value={min}
            onChange={(e) => setMin(e.target.value)}
            className="w-28 text-right border-b border-stone-300 outline-none tabular-nums"
          />
        </label>
        <div className="flex gap-2 mt-1">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button
            onClick={() => void onConfirm(b, m)} disabled={!valid}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40"
          >Save</button>
        </div>
      </div>
    </div>
  );
}
