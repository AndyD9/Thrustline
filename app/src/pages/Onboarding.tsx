import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Plane, Building2, MapPin, Rocket } from "lucide-react";

export default function Onboarding() {
  const { user } = useAuth();
  const { refetch } = useCompany();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  const [hubIcao, setHubIcao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("companies").insert({
        user_id: user.id,
        name: name.trim(),
        airline_code: airlineCode.trim().toUpperCase(),
        hub_icao: hubIcao.trim().toUpperCase(),
        capital: 1_000_000,
        onboarded: true,
      });
      if (insertError) throw insertError;
      await refetch();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create airline");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6 overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/3 top-1/3 h-96 w-96 rounded-full bg-brand-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/3 h-72 w-72 rounded-full bg-accent-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-xl animate-slide-up">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-10 backdrop-blur-2xl glow-brand">
          {/* Header */}
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15">
              <Rocket className="h-5 w-5 text-brand-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Create your airline</h1>
            </div>
          </div>
          <p className="mb-8 text-sm text-slate-400">
            You start with <span className="font-semibold text-brand-300">$1,000,000</span> in capital.
            Let's get your operations off the ground.
          </p>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Airline name */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Airline name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Thrustline Airways"
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50 focus:glow-brand-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Airline code */}
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Airline code (IATA/ICAO)
                </label>
                <div className="relative">
                  <Plane className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={airlineCode}
                    onChange={(e) => setAirlineCode(e.target.value.toUpperCase())}
                    placeholder="TRS"
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm font-mono text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50 focus:glow-brand-sm"
                  />
                </div>
              </div>

              {/* Hub airport */}
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Hub airport (ICAO)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={hubIcao}
                    onChange={(e) => setHubIcao(e.target.value.toUpperCase())}
                    placeholder="LFPG"
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm font-mono text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50 focus:glow-brand-sm"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-400 hover:shadow-[0_0_24px_oklch(0.58_0.18_195_/_0.3)] disabled:opacity-50"
            >
              {submitting ? (
                "Creating…"
              ) : (
                <>
                  Launch my airline
                  <Rocket className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
