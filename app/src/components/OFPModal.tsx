import { X, Route, Fuel, Weight, Clock, Plane } from "lucide-react";
import type { SimBriefOFP } from "@/lib/simbrief";

interface OFPModalProps {
  ofp: SimBriefOFP;
  onClose: () => void;
  onApply?: (ofp: SimBriefOFP) => void;
}

function formatMinutes(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatUnixUTC(ts: number): string {
  if (!ts) return "\u2014";
  const d = new Date(ts * 1000);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")} UTC`;
}

export default function OFPModal({ ofp, onClose, onApply }: OFPModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-surface-100/95 p-6 shadow-2xl backdrop-blur-xl glow-brand-sm animate-slide-up">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">SimBrief OFP</h2>
            <p className="text-xs text-slate-500">
              {ofp.origin.icao} → {ofp.destination.icao} · {ofp.aircraft.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Route */}
          <Section icon={Route} title="Route">
            <div className="font-mono text-xs text-slate-300 leading-relaxed break-all">
              {ofp.general.route || "Direct"}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-500">
              <span>Distance: {ofp.general.distance} nm</span>
              <span>Air: {ofp.general.airDistance} nm</span>
              <span>FL{(ofp.general.cruiseAlt / 100).toFixed(0)}</span>
            </div>
          </Section>

          {/* Fuel */}
          <Section icon={Fuel} title="Fuel (lbs)">
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Block" value={ofp.fuel.total.toLocaleString()} />
              <Stat label="Taxi" value={ofp.fuel.taxi.toLocaleString()} />
              <Stat label="Enroute" value={ofp.fuel.enroute.toLocaleString()} />
              <Stat label="Reserve" value={ofp.fuel.reserve.toLocaleString()} />
            </div>
          </Section>

          {/* Weights */}
          <Section icon={Weight} title="Weights (lbs)">
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Pax" value={String(ofp.weights.paxCount)} />
              <Stat label="ZFW" value={ofp.weights.zfw.toLocaleString()} />
              <Stat label="TOW" value={ofp.weights.tow.toLocaleString()} />
              <Stat label="LDW" value={ofp.weights.ldw.toLocaleString()} />
            </div>
          </Section>

          {/* Times */}
          <Section icon={Clock} title="Times">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Enroute" value={formatMinutes(ofp.times.estimEnroute)} />
              <Stat label="Sched Out" value={formatUnixUTC(ofp.times.schedOut)} />
              <Stat label="Sched In" value={formatUnixUTC(ofp.times.schedIn)} />
            </div>
          </Section>

          {/* Aircraft */}
          <Section icon={Plane} title="Aircraft">
            <div className="text-sm text-slate-300">
              <span className="font-mono font-bold text-brand-400">{ofp.aircraft.icaoType}</span>
              {" — "}
              {ofp.aircraft.name}
            </div>
          </Section>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          {onApply && (
            <button
              onClick={() => onApply(ofp)}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400"
            >
              Apply to dispatch
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm text-slate-300 transition-all hover:border-white/[0.15] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Route;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-600">{label}</div>
      <div className="font-mono text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}
