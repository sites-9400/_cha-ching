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
      <div className="min-h-screen bg-stone-100 text-stone-900 pb-16 max-w-md mx-auto">
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
