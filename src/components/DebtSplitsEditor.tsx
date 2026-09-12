import { peso } from "../lib/format";
import { splitsRemainder } from "../lib/debtSplits";
import type { Debt, DebtSplit } from "../lib/types";

const activeSorted = (debts: Debt[]) => [...debts].filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);

/**
 * "Pays debt" picker that can address one debt (a plain select, as before) or
 * several (a list of debt+amount rows). Single mode emits `{debtId}`, split
 * mode emits `{debtSplits}`. The parent decides how to persist the switch
 * (clearing the field that's no longer in use). Disabled while the line is
 * already ticked, since re-linking would orphan a logged payment.
 */
export default function DebtSplitsEditor({
  debts, amount, debtId, debtSplits, disabled, onChange,
}: {
  debts: Debt[];
  amount: number;
  debtId?: string;
  debtSplits?: DebtSplit[];
  disabled?: boolean;
  onChange: (v: { debtId?: string; debtSplits?: DebtSplit[] }) => void;
}) {
  const splitting = !!debtSplits && debtSplits.length > 0;
  const rows = debtSplits ?? [];
  const remainder = splitsRemainder(amount, rows);

  function setRows(next: DebtSplit[]) {
    onChange({ debtId: undefined, debtSplits: next });
  }

  function startSplitting() {
    const seed: DebtSplit[] = debtId ? [{ debtId, amount }] : [{ debtId: "", amount: 0 }];
    onChange({ debtId: undefined, debtSplits: seed });
  }

  function stopSplitting() {
    onChange({ debtId: undefined, debtSplits: undefined });
  }

  if (!splitting) {
    return (
      <>
        <label className="flex items-center justify-between text-sm gap-2">
          <span className="shrink-0">Pays debt</span>
          <select
            value={debtId ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ debtId: e.target.value || undefined, debtSplits: undefined })}
            className="text-sm border-b border-stone-300 outline-none min-w-0 flex-1 text-right disabled:opacity-40"
          >
            <option value="">— none —</option>
            {activeSorted(debts).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <p className="text-[11px] text-stone-400 -mt-1">
          {disabled ? "Untick the line first to change which debt it pays." : "Ticking this line PAID logs a payment to that debt."}
        </p>
        {!disabled && (
          <button type="button" onClick={startSplitting} className="text-xs font-semibold text-emerald-700 self-start">
            Split across debts
          </button>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">Pays debts</span>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select
              value={row.debtId}
              disabled={disabled}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, debtId: e.target.value } : r)))}
              className="text-sm border-b border-stone-300 outline-none min-w-0 flex-1 disabled:opacity-40"
            >
              <option value="">— choose —</option>
              {activeSorted(debts).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input
              type="number" inputMode="decimal" value={row.amount || ""} disabled={disabled}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, amount: Number(e.target.value) } : r)))}
              className="w-20 text-right border-b border-stone-300 outline-none tabular-nums disabled:opacity-40"
            />
            {!disabled && (
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-red-500 text-xs px-1">✕</button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <button type="button" onClick={() => setRows([...rows, { debtId: "", amount: 0 }])} className="text-xs font-semibold text-emerald-700 self-start">
          + add debt
        </button>
      )}
      <p className={`text-[11px] ${remainder === 0 ? "text-stone-400" : "text-amber-600"}`}>
        {peso(remainder)} unallocated
      </p>
      <p className="text-[11px] text-stone-400 -mt-1">
        {disabled ? "Untick the line first to change which debt it pays." : "Ticking this line PAID logs one payment per debt above."}
      </p>
      {!disabled && (
        <button type="button" onClick={stopSplitting} className="text-xs font-semibold text-emerald-700 self-start">
          Use one debt instead
        </button>
      )}
    </div>
  );
}
