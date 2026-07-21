import type { Dispatch } from "@/lib/database.types";

export interface BoardingProgress {
  boardedEco: number;
  boardedBiz: number;
  boardedTotal: number;
  plannedTotal: number;
  progressPct: number;
  remainingSeconds: number;
  complete: boolean;
}

export function boardingDurationSeconds(dispatch: Pick<Dispatch, "pax_eco" | "pax_biz">): number {
  const total = dispatch.pax_eco + dispatch.pax_biz;
  return Math.round(30 + Math.min(60, total * 0.35));
}

export function computeBoardingProgress(dispatch: Dispatch, nowMs = Date.now()): BoardingProgress {
  const plannedTotal = dispatch.pax_eco + dispatch.pax_biz;
  if (!dispatch.boarding_started_at || plannedTotal === 0) {
    const complete = plannedTotal === 0;
    return { boardedEco: 0, boardedBiz: 0, boardedTotal: 0, plannedTotal, progressPct: complete ? 100 : 0, remainingSeconds: 0, complete };
  }

  const durationSeconds = boardingDurationSeconds(dispatch);
  const elapsedSeconds = Math.max(0, (nowMs - new Date(dispatch.boarding_started_at).getTime()) / 1000);
  const normalized = Math.min(1, elapsedSeconds / durationSeconds);

  // Business boards first during the first 20% of the operation. Economy
  // starts shortly afterwards and uses the remaining 80%.
  const businessProgress = Math.min(1, normalized / 0.2);
  const economyProgress = Math.max(0, Math.min(1, (normalized - 0.12) / 0.88));
  const boardedBiz = Math.min(dispatch.pax_biz, Math.floor(dispatch.pax_biz * businessProgress));
  const boardedEco = Math.min(dispatch.pax_eco, Math.floor(dispatch.pax_eco * economyProgress));
  const complete = normalized >= 1;
  const finalBiz = complete ? dispatch.pax_biz : boardedBiz;
  const finalEco = complete ? dispatch.pax_eco : boardedEco;
  const boardedTotal = finalBiz + finalEco;

  return {
    boardedEco: finalEco,
    boardedBiz: finalBiz,
    boardedTotal,
    plannedTotal,
    progressPct: plannedTotal === 0 ? 100 : (boardedTotal / plannedTotal) * 100,
    remainingSeconds: Math.max(0, Math.ceil(durationSeconds - elapsedSeconds)),
    complete,
  };
}
