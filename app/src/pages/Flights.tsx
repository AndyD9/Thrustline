import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/hooks/useCompany";
import type { Flight } from "@/lib/database.types";

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Flights() {
  const { company } = useCompany();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    supabase
      .from("flights")
      .select("*")
      .eq("company_id", company.id)
      .order("completed_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setFlights((data as Flight[]) ?? []);
        setLoading(false);
      });
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!company) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Flight log</h1>

      {loading ? (
        <div className="text-slate-400">Loading…</div>
      ) : flights.length === 0 ? (
        <div className="glass px-5 py-8 text-center text-sm text-slate-400">
          No flights yet. Dispatch one and fly it in MSFS.
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-right">Distance</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-right">Fuel</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-right">Landed</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f) => (
                <tr key={f.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-mono text-slate-200">
                    {f.departure_icao} → {f.arrival_icao}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {Number(f.distance_nm).toFixed(0)} nm
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {f.duration_min} min
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {Number(f.fuel_used_gal).toFixed(0)} gal
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {currency(Number(f.revenue))}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${Number(f.net_result) >= 0 ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {currency(Number(f.net_result))}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] text-slate-500">
                    {new Date(f.completed_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
