import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { useDoc } from "../hooks/useDoc";
import { currentMonthKey, monthIndex } from "../lib/clock";
import { debtsCol, fundsCol, metaDoc } from "../lib/paths";
import { updateMeta } from "../lib/repo";
import { debtTotals } from "../lib/selectors";
import type { Debt, Meta, SinkingFund } from "../lib/types";
import type { PaymentRec } from "./DebtPlan";
import SavingsMeter from "./dashboard/SavingsMeter";
import FundTiles from "./dashboard/FundTiles";

export default function Dashboard() {
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const funds = useCollection<SinkingFund>(fundsCol());
  const meta = useDoc<Meta>(metaDoc());

  const monthKey = currentMonthKey();
  const { blitz } = debtTotals(debts);
  void payments; // consumed by the debt-curve chart (added next build step)

  return (
    <main className="p-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold">Stats</h1>

      <SavingsMeter
        balance={meta?.savingsBalance ?? 0}
        floor={meta?.savingsFloor ?? 100000}
        onSave={(v) => updateMeta({ savingsBalance: v })}
      />

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-sm mb-1">Debt remaining</h2>
        <p className="text-2xl font-bold tabular-nums">{blitz.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
        <p className="text-xs text-stone-400">interest-bearing (curve coming next)</p>
      </section>

      <FundTiles funds={funds} monthIndex={monthIndex(monthKey)} />
    </main>
  );
}
