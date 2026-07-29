import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { useDoc } from "../hooks/useDoc";
import { currentMonthKey, localIso, monthIndex } from "../lib/clock";
import { peso } from "../lib/format";
import { categoriesCol, debtsCol, expensesCol, fundsCol, metaDoc } from "../lib/paths";
import { addSavingsMove } from "../lib/repo";
import { debtTotals } from "../lib/selectors";
import { debtCurve } from "../lib/stats";
import type { Category, Debt, Meta, SinkingFund } from "../lib/types";
import type { PaymentRec } from "./DebtPlan";
import HeaderBand from "./HeaderBand";
import SavingsMeter from "./dashboard/SavingsMeter";
import SavingsHistory from "./dashboard/SavingsHistory";
import SavingsMoveDialog from "./dashboard/SavingsMoveDialog";
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
  const [movingSavings, setMovingSavings] = useState(false);

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
        onAdd={() => setMovingSavings(true)}
        onSave={(v) => {
          // A typed-over balance is a correction: record the delta so the
          // history still explains the number.
          const delta = v - (meta?.savingsBalance ?? 0);
          if (delta === 0) return;
          return addSavingsMove({
            amount: Math.abs(delta),
            direction: delta > 0 ? "in" : "out",
            source: "Correction",
            date: localIso(),
          });
        }}
      />

      <SavingsHistory expenses={expenses} />

      <DebtCurveChart points={curve} />

      <CategoryBars expenses={expenses} monthKey={monthKey} categories={categories} />

      <FundTiles funds={funds} monthIndex={monthIndex(monthKey)} />
      {movingSavings && <SavingsMoveDialog onClose={() => setMovingSavings(false)} />}
      </main>
    </>
  );
}
