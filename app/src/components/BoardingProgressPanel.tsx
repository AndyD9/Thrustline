import { BriefcaseBusiness, Clock3, Users } from "lucide-react";
import type { Dispatch } from "@/lib/database.types";
import { computeBoardingProgress } from "@/lib/boarding";

export default function BoardingProgressPanel({ dispatch, nowMs }: { dispatch: Dispatch; nowMs: number }) {
  const progress = computeBoardingProgress(dispatch, nowMs);

  return (
    <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-300">
          <Users className="h-4 w-4" /> Passenger boarding
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
          <Clock3 className="h-3.5 w-3.5" />
          {progress.remainingSeconds}s
        </div>
      </div>

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-brand-400 transition-all duration-500"
          style={{ width: `${progress.progressPct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <Count icon={BriefcaseBusiness} label="Business" value={progress.boardedBiz} total={dispatch.pax_biz} />
        <Count icon={Users} label="Economy" value={progress.boardedEco} total={dispatch.pax_eco} />
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-slate-600">Total</div>
          <div className="mt-0.5 font-mono font-semibold text-white">{progress.boardedTotal} / {progress.plannedTotal}</div>
        </div>
      </div>
    </div>
  );
}

function Count({ icon: Icon, label, value, total }: {
  icon: typeof Users; label: string; value: number; total: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-600">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 font-mono font-semibold text-slate-200">{value} / {total}</div>
    </div>
  );
}
