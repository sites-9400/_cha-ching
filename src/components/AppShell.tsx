import { useState } from "react";
import TabBar, { type TabId } from "./TabBar";
import MonthProvider from "./MonthProvider";
import ThisMonth from "./ThisMonth";
import QuickAdd from "./QuickAdd";
import Debts from "./Debts";
import Settings from "./Settings";
import Dashboard from "./Dashboard";

export default function AppShell() {
  const [tab, setTab] = useState<TabId>("month");
  return (
    <MonthProvider>
      {/* Bottom reserve must clear the fixed TabBar, whose height is set by the
          raised centre button (py-2 + h-14 = 72px) plus the device safe-area
          inset — a flat pb-16 left the last ~42px of every page under the nav. */}
      <div className="min-h-screen bg-stone-100 text-stone-900 pb-[calc(6rem_+_env(safe-area-inset-bottom))] max-w-md mx-auto">
        {tab === "month" && <ThisMonth />}
        {tab === "debts" && <Debts />}
        {tab === "add" && <QuickAdd />}
        {tab === "dashboard" && <Dashboard />}
        {tab === "settings" && <Settings />}
        <TabBar active={tab} onChange={setTab} />
      </div>
    </MonthProvider>
  );
}
