import { useState } from "react";
import { useDoc } from "../hooks/useDoc";
import { metaDoc } from "../lib/paths";
import { peso } from "../lib/format";
import { allocateCutoff } from "../lib/allocate";
import { cutoffAllocation, fundingByChannel, paidByDebt } from "../lib/funding";
import type { Debt, Meta, MonthLine } from "../lib/types";
import type { PaymentRec } from "./DebtPlan";
import { useAccounts } from "./AccountsProvider";

/** "Send to accounts" — how much to fund each channel this cutoff (bills + debt payments). */
export default function SendPlan({
  freeCash, debts, payments, lines, monthKey, cutoff, cycleMins, cycleMinsGross,
}: {
  freeCash: number; debts: Debt[]; payments: PaymentRec[]; lines: MonthLine[];
  monthKey: string; cutoff: 1 | 2;
  cycleMins?: ReadonlyMap<string, number>; cycleMinsGross?: ReadonlyMap<string, number>;
}) {
  const { chip, label } = useAccounts();
  const meta = useDoc<Meta>(metaDoc());
  const incomeChannel = meta?.incomeChannel;
  const [mode, setMode] = useState<"remaining" | "full">("remaining");

  const paid = paidByDebt(payments, monthKey, cutoff);
  const paidTotal = [...paid.values()].reduce((s, n) => s + n, 0);
  // "remaining": the leftover free cash allocated on live balances (matches the debt
  // plan). "full": the whole cutoff's allocation on start-of-cutoff balances.
  const alloc = mode === "remaining"
    ? allocateCutoff(Math.max(0, freeCash - paidTotal), debts, cutoff, cycleMins)
    : cutoffAllocation(freeCash, debts, paid, cutoff, cycleMinsGross);
  const sends = fundingByChannel(lines, alloc.lines, mode, incomeChannel);
  const grandTotal = sends.reduce((s, x) => s + x.total, 0);

  if (sends.length === 0) return null;

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-stone-500">SEND TO ACCOUNTS</p>
        <div className="flex rounded-full bg-stone-100 p-0.5 text-[10px] font-semibold">
          {(["remaining", "full"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded-full ${mode === m ? "bg-white shadow text-stone-700" : "text-stone-400"}`}
            >
              {m === "remaining" ? "Left to send" : "Full"}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {sends.map((s) => (
          <li key={s.channel} className="flex items-center justify-between gap-2 text-sm">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chip(s.channel)}`}>{label(s.channel)}</span>
            <span className="font-bold tabular-nums">{peso(s.total)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs flex justify-between text-stone-400">
        <span>{mode === "remaining" ? "Still to send" : "Cutoff total"}{incomeChannel ? ` (from ${label(incomeChannel)})` : ""}</span>
        <span className="font-semibold tabular-nums text-stone-600">{peso(grandTotal)}</span>
      </p>
    </div>
  );
}
