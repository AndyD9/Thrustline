import { useCompany } from "@/contexts/CompanyContext";
import { useSim } from "@/contexts/SimContext";

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Dashboard() {
  const { company, loading } = useCompany();
  const { lastLanding, lastTakeoff, simActive } = useSim();

  if (loading) return <Placeholder label="Loading company…" />;
  if (!company) return <Placeholder label="No company — complete onboarding." />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <p className="text-sm text-slate-400">
          {company.airline_code} · Hub {company.hub_icao}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="Capital"   value={currency(company.capital)} accent />
        <Card label="Sim"       value={simActive ? "Connected" : "Offline"} />
        <Card
          label="Last landing"
          value={
            lastLanding
              ? `${lastLanding.distanceNm.toFixed(0)} nm · ${Math.abs(
                  lastLanding.landingVsFpm,
                ).toFixed(0)} fpm`
              : "—"
          }
        />
      </div>

      {lastTakeoff && !lastLanding && (
        <div className="glass px-5 py-4 text-sm">
          <div className="text-brand-300">Flight in progress</div>
          <div className="mt-1 text-slate-300">
            Takeoff at {new Date(lastTakeoff.timestamp).toLocaleTimeString()} —
            fuel on board {lastTakeoff.fuelTotalGal.toFixed(0)} gal
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="glass px-5 py-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold ${accent ? "text-brand-300" : "text-slate-100"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-slate-400">
      {label}
    </div>
  );
}
