import { useState } from "react";
import { ChevronDown, Clock3, FileText, Fuel, Gauge, RefreshCw, Route, Weight } from "lucide-react";
import type { SimBriefOFP } from "@/lib/simbrief";
import { useUnits } from "@/contexts/UnitsContext";

interface OFPSummaryProps {
  ofp: SimBriefOFP;
  defaultOpen?: boolean;
  onRefresh?: () => Promise<void>;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + "Z";
}

function qnhLabel(qnh?: number): string {
  return qnh ? `${qnh} hPa` : "—";
}

export default function OFPSummary({ ofp, defaultOpen = false, onRefresh }: OFPSummaryProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [refreshing, setRefreshing] = useState(false);
  const { fmt } = useUnits();

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-brand-500/15 bg-brand-500/[0.025]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.025]"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-4 w-4 shrink-0 text-brand-400" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">OFP Summary</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-slate-400">
              <span>FL{Math.round(ofp.general.cruiseAlt / 100)}</span>
              <span>{formatDuration(ofp.times.estimEnroute)}</span>
              <span>Block {fmt.weight(ofp.fuel.total)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRefresh && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                if (refreshing) return;
                setRefreshing(true);
                void onRefresh().finally(() => setRefreshing(false));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") event.currentTarget.click();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 transition-colors hover:border-brand-500/25 hover:text-brand-300"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing" : "Refresh OFP"}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/[0.05] px-4 py-4 animate-fade-in">
          <div>
            <SummaryTitle icon={Route} label="ATC route" />
            <div className="break-words font-mono text-xs leading-5 text-slate-300">
              {ofp.general.route || "Direct"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <AirportBrief
              label="Departure"
              icao={ofp.origin.icao}
              runway={ofp.origin.runway}
              procedure={ofp.general.sid}
              qnh={ofp.origin.qnhHpa}
              metar={ofp.origin.metar}
            />
            <AirportBrief
              label="Arrival"
              icao={ofp.destination.icao}
              runway={ofp.destination.runway}
              procedure={ofp.general.star}
              qnh={ofp.destination.qnhHpa}
              metar={ofp.destination.metar}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Fuel} label="Block fuel" value={fmt.weight(ofp.fuel.total)} />
            <Stat icon={Gauge} label="Trip fuel" value={fmt.weight(ofp.fuel.enroute)} />
            <Stat icon={Weight} label="Takeoff weight" value={fmt.weight(ofp.weights.tow)} />
            <Stat icon={Clock3} label="Schedule" value={`${formatTime(ofp.times.schedOut)} → ${formatTime(ofp.times.schedIn)}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTitle({ icon: Icon, label }: { icon: typeof Route; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function AirportBrief({
  label,
  icao,
  runway,
  procedure,
  qnh,
  metar,
}: {
  label: string;
  icao: string;
  runway?: string;
  procedure?: string;
  qnh?: number;
  metar?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">{label}</div>
          <div className="mt-1 font-mono text-sm font-semibold text-white">{icao}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold text-brand-300">QNH {qnhLabel(qnh)}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            RWY {runway || "—"}{procedure ? ` · ${procedure}` : ""}
          </div>
        </div>
      </div>
      {metar && <div className="mt-3 break-words font-mono text-[10px] leading-4 text-slate-500">{metar}</div>}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Fuel; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/10 p-3">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-600">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1.5 font-mono text-xs font-medium text-slate-200">{value}</div>
    </div>
  );
}
