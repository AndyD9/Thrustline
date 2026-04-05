import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function Onboarding() {
  const { user } = useAuth();
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
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create airline");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-strong w-full max-w-xl p-10">
        <h1 className="mb-1 text-2xl font-semibold">Create your airline</h1>
        <p className="mb-8 text-sm text-slate-400">
          You start with <span className="text-brand-300">$1,000,000</span> in capital.
          Let's get your operations off the ground.
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <Field
            label="Airline name"
            value={name}
            onChange={setName}
            placeholder="Thrustline Airways"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Airline code (IATA/ICAO)"
              value={airlineCode}
              onChange={(v) => setAirlineCode(v.toUpperCase())}
              placeholder="TRS"
              required
            />
            <Field
              label="Hub airport (ICAO)"
              value={hubIcao}
              onChange={(v) => setHubIcao(v.toUpperCase())}
              placeholder="LFPG"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Launch my airline"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-400"
      />
    </label>
  );
}
