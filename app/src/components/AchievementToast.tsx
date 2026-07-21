import { useEffect, useState } from "react";
import { useSim } from "@/contexts/SimContext";
import { Trophy } from "lucide-react";
import type { AchievementPayload } from "@/hooks/useSimStream";

/**
 * Global toast that appears when an achievement is unlocked.
 * Rendered in Layout.tsx so it works from any page.
 */
export function AchievementToast() {
  const { latestAchievement } = useSim();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<AchievementPayload | null>(null);

  useEffect(() => {
    if (!latestAchievement) return;
    setCurrent(latestAchievement);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [latestAchievement]);

  if (!visible || !current) return null;

  return (
    <div className="fixed right-6 top-6 z-50 animate-slide-up">
      <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-[#0a0f18]/95 px-6 py-4 backdrop-blur-md shadow-lg shadow-amber-500/10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15">
          <Trophy className="h-6 w-6 text-amber-300" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-amber-400">
            Achievement Unlocked!
          </div>
          <div className="text-base font-bold text-white">{current.title}</div>
          <div className="text-xs text-slate-400">{current.description}</div>
        </div>
      </div>
    </div>
  );
}
