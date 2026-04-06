import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Plane, Mail, Lock, ArrowRight } from "lucide-react";

type Mode = "signin" | "signup";

export default function Auth() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") await signInWithPassword(email, password);
      else await signUpWithPassword(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center p-6 overflow-hidden">
      {/* Animated background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-brand-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-accent-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-10 backdrop-blur-2xl glow-brand">

          {/* Logo */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 glow-brand-sm">
              <Plane className="h-7 w-7 text-brand-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Thrustline</h1>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "signin" ? "Sign in to your airline" : "Create your airline account"}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pilot@thrustline.app"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50 focus:glow-brand-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50 focus:glow-brand-sm"
                />
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
                "Please wait…"
              ) : (
                <>
                  {mode === "signin" ? "Sign in" : "Sign up"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 w-full text-center text-xs text-slate-400 transition-colors hover:text-brand-300"
          >
            {mode === "signin"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
