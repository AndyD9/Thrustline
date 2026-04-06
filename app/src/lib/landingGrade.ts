/**
 * Landing grade computation — miroir du backend LandingGradeService.
 * Utilise cote frontend pour affichage instantane apres touchdown
 * (avant le round-trip Supabase).
 */

export interface GradeResult {
  grade: string;
  label: string;
  color: string; // Tailwind text color class
  bgColor: string; // Tailwind bg color class
}

export function computeGrade(landingVsFpm: number): GradeResult {
  const absVs = Math.abs(landingVsFpm);

  if (absVs < 60) return { grade: "A+", label: "Butter", color: "text-emerald-400", bgColor: "bg-emerald-500/20" };
  if (absVs < 100) return { grade: "A", label: "Excellent", color: "text-emerald-400", bgColor: "bg-emerald-500/20" };
  if (absVs < 150) return { grade: "B+", label: "Greaser", color: "text-brand-400", bgColor: "bg-brand-500/20" };
  if (absVs < 200) return { grade: "B", label: "Very Nice", color: "text-brand-400", bgColor: "bg-brand-500/20" };
  if (absVs < 300) return { grade: "C+", label: "Good", color: "text-amber-400", bgColor: "bg-amber-500/20" };
  if (absVs < 400) return { grade: "C", label: "Acceptable", color: "text-amber-400", bgColor: "bg-amber-500/20" };
  if (absVs < 600) return { grade: "D", label: "Firm", color: "text-orange-400", bgColor: "bg-orange-500/20" };
  if (absVs < 800) return { grade: "D-", label: "Hard", color: "text-orange-400", bgColor: "bg-orange-500/20" };
  if (absVs < 1000) return { grade: "F+", label: "Very Hard", color: "text-red-400", bgColor: "bg-red-500/20" };
  return { grade: "F", label: "Dangerous", color: "text-red-400", bgColor: "bg-red-500/20" };
}

/** Map a grade string to its color classes (for displaying from DB data). */
export function gradeColors(grade: string): { color: string; bgColor: string } {
  if (grade.startsWith("A")) return { color: "text-emerald-400", bgColor: "bg-emerald-500/20" };
  if (grade.startsWith("B")) return { color: "text-brand-400", bgColor: "bg-brand-500/20" };
  if (grade.startsWith("C")) return { color: "text-amber-400", bgColor: "bg-amber-500/20" };
  if (grade.startsWith("D")) return { color: "text-orange-400", bgColor: "bg-orange-500/20" };
  return { color: "text-red-400", bgColor: "bg-red-500/20" };
}

/** Convert grade to numeric score for charting (A+=10, A=9, ... F=1). */
export function gradeToScore(grade: string): number {
  const map: Record<string, number> = {
    "A+": 10, "A": 9, "B+": 8, "B": 7, "C+": 6, "C": 5, "D": 4, "D-": 3, "F+": 2, "F": 1,
  };
  return map[grade] ?? 0;
}
