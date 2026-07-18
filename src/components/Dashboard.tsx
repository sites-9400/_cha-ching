import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { useDoc } from "../hooks/useDoc";
import { currentMonthKey, monthIndex } from "../lib/clock";
import { peso } from "../lib/format";
import { categoriesCol, debtsCol, expensesCol, fundsCol, metaDoc } from "../lib/paths";
import { updateMeta } from "../lib/repo";
import { debtTotals } from "../lib/selectors";
import { debtCurve } from "../lib/stats";
import type { Category, Debt, Meta, SinkingFund } from "../lib/types";
import type { PaymentRec } from "./DebtPlan";
import HeaderBand from "./HeaderBand";
import SavingsMeter from "./dashboard/SavingsMeter";
import FundTiles from "./dashboard/FundTiles";
import CategoryBars, { type DashExpense } from "./dashboard/CategoryBars";
import DebtCurveChart from "./dashboard/DebtCurveChart";
import SpendingCalendar from "./dashboard/SpendingCalendar";

export default function Dashboard() {
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const funds = useCollection<SinkingFund>(fundsCol());
  const expenses = useCollection<DashExpense>(expensesCol());
  const categories = useCollection<Category>(categoriesCol());
  const meta = useDoc<Meta>(metaDoc());

  const monthKey = currentMonthKey();
  const { blitz } = debtTotals(debts);

  // Debt curve: payments against tracked (non-BNPL) debts only.
  const trackedIds = new Set(debts.filter((d) => !d.isBNPL).map((d) => d.id));
  const curve = debtCurve(blitz, payments.filter((p) => trackedIds.has(p.debtId)));

  return (
    <>
      <HeaderBand title="SAVINGS" value={peso(meta?.savingsBalance ?? 0)} />
      <main className="p-4 flex flex-col gap-4">
      <SpendingCalendar expenses={expenses} />

      <SavingsMeter
        balance={meta?.savingsBalance ?? 0}
        floor={meta?.savingsFloor ?? 100000}
        onSave={(v) => updateMeta({ savingsBalance: v })}
      />

      <DebtCurveChart points={curve} />

      <CategoryBars expenses={expenses} monthKey={monthKey} categories={categories} />

      <FundTiles funds={funds} monthIndex={monthIndex(monthKey)} />
      </main>
    </>
  );
}
