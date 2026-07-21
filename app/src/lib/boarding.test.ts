import { describe, expect, it } from "vitest";
import { boardingDurationSeconds, computeBoardingProgress } from "./boarding";
import type { Dispatch } from "./database.types";

function dispatch(overrides: Partial<Dispatch> = {}): Dispatch {
  return {
    id: "dispatch-1", user_id: "user-1", company_id: "company-1", aircraft_id: null,
    flight_number: "TL101", origin_icao: "LFPG", dest_icao: "EGLL", icao_type: "A320",
    pax_eco: 100, pax_biz: 10, boarded_pax_eco: 0, boarded_pax_biz: 0,
    boarding_started_at: "2026-07-21T10:00:00.000Z", boarding_completed_at: null,
    cargo_kg: 0, estim_fuel_lbs: 0, cruise_alt: 35000, status: "boarding", ofp_data: null,
    created_at: "2026-07-21T09:00:00.000Z", updated_at: "2026-07-21T09:00:00.000Z",
    ...overrides,
  };
}

describe("boarding progression", () => {
  it("keeps the duration between 30 and 90 seconds", () => {
    expect(boardingDurationSeconds(dispatch({ pax_eco: 0, pax_biz: 0 }))).toBe(30);
    expect(boardingDurationSeconds(dispatch({ pax_eco: 500, pax_biz: 50 }))).toBe(90);
  });

  it("boards business passengers before economy", () => {
    const item = dispatch();
    const elapsedMs = boardingDurationSeconds(item) * 0.15 * 1000;
    const progress = computeBoardingProgress(item, new Date(item.boarding_started_at!).getTime() + elapsedMs);
    expect(progress.boardedBiz).toBeGreaterThan(0);
    expect(progress.boardedEco).toBeGreaterThanOrEqual(0);
    expect(progress.boardedBiz / item.pax_biz).toBeGreaterThan(progress.boardedEco / item.pax_eco);
  });

  it("finishes with every planned passenger aboard", () => {
    const item = dispatch();
    const endMs = new Date(item.boarding_started_at!).getTime() + boardingDurationSeconds(item) * 1000;
    expect(computeBoardingProgress(item, endMs)).toMatchObject({
      boardedBiz: 10,
      boardedEco: 100,
      boardedTotal: 110,
      progressPct: 100,
      complete: true,
    });
  });
});
