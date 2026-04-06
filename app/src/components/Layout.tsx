import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SimStatusBadge } from "./SimStatusBadge";
import { LiveFlightBar } from "./LiveFlightBar";
import { AchievementToast } from "./AchievementToast";
import { useCompany } from "@/contexts/CompanyContext";
import { X, Receipt } from "lucide-react";

export function Layout() {
  const { billingResult, clearBillingResult } = useCompany();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-0">
      <AchievementToast />
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4">
          <div />
          <SimStatusBadge />
        </header>

        {/* Billing notification */}
        {billingResult && (
          <div className="mx-3 mb-3 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-5 py-3 text-xs animate-slide-up">
            <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex-1">
              <div className="font-semibold text-amber-300">
                Monthly charges deducted ({billingResult.monthsBilled} month{billingResult.monthsBilled > 1 ? "s" : ""})
              </div>
              <div className="mt-1 space-y-0.5 text-slate-400">
                {billingResult.details.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>
              <div className="mt-1.5 font-mono font-semibold text-amber-300">
                Total: -${billingResult.totalDeducted.toLocaleString()}
              </div>
            </div>
            <button onClick={clearBillingResult} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <LiveFlightBar />

        <main className="flex-1 overflow-y-auto px-6 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
