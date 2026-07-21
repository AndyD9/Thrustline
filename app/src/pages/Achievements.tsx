import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { Achievement } from "@/lib/database.types";
import {
  Trophy,
  Plane,
  Heart,
  Zap,
  Star,
  Globe,
  Clock,
  Timer,
  MapIcon,
  MapPin,
  Banknote,
  Fuel,
  Smile,
  Award,
  Crown,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  plane: Plane,
  heart: Heart,
  zap: Zap,
  star: Star,
  globe: Globe,
  "globe-2": Globe,
  clock: Clock,
  timer: Timer,
  map: MapIcon,
  "map-pin": MapPin,
  banknote: Banknote,
  fuel: Fuel,
  smile: Smile,
  award: Award,
  crown: Crown,
  trophy: Trophy,
};

export default function Achievements() {
  const { company } = useCompany();
  const [earned, setEarned] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    supabase
      .from("achievements")
      .select("*")
      .eq("company_id", company.id)
      .order("unlocked_at", { ascending: false })
      .then(({ data }) => {
        setEarned((data as Achievement[]) ?? []);
        setLoading(false);
      });
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!company) return null;

  const earnedKeys = new Set(earned.map((a) => a.key));
  const unlockedCount = earnedKeys.size;
  const totalCount = ACHIEVEMENTS.length;
  const progress = Math.round((unlockedCount / totalCount) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Achievements</h1>
        <p className="text-sm text-slate-400">
          {unlockedCount} / {totalCount} unlocked
        </p>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">Progress</span>
          <span className="font-mono font-bold text-amber-300">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ACHIEVEMENTS.map((def) => {
            const isUnlocked = earnedKeys.has(def.key);
            const earnedData = earned.find((a) => a.key === def.key);
            const Icon = ICON_MAP[def.icon] ?? Trophy;

            return (
              <div
                key={def.key}
                className={`rounded-xl border px-5 py-4 transition-all ${
                  isUnlocked
                    ? "border-amber-500/20 bg-amber-500/[0.04] hover:bg-amber-500/[0.06]"
                    : "border-white/[0.04] bg-white/[0.01] opacity-50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isUnlocked ? "bg-amber-500/15" : "bg-white/[0.04]"
                    }`}
                  >
                    {isUnlocked ? (
                      <Icon className="h-5 w-5 text-amber-300" />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${isUnlocked ? "text-white" : "text-slate-500"}`}>
                      {def.title}
                    </div>
                    <div className="text-xs text-slate-500">{def.description}</div>
                    {earnedData && (
                      <div className="mt-1 text-[10px] text-amber-400/60">
                        {new Date(earnedData.unlocked_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
