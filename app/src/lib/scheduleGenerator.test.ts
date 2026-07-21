import { describe, expect, it } from "vitest";
import { generateSchedule } from "@/lib/scheduleGenerator";

describe("generateSchedule timed operations", () => {
  it("spaces passive-ready legs by their duration and ground time", () => {
    const startAt = new Date("2026-07-22T08:00:00.000Z");
    const result = generateSchedule({
      startIcao: "LFPG",
      hubIcao: "LFPG",
      cruiseSpeedKts: 450,
      rangeNm: 3000,
      targetFlights: 3,
      targetRotations: 1,
      maxTotalMinutes: 600,
      maxLegMinutes: 180,
      returnToHub: true,
      airlineCode: "TL",
      startAt,
      groundMinutes: 45,
      timeScale: 1,
      seed: 42,
    });

    const legs = result.rotations.flatMap((rotation) => rotation.legs);
    expect(legs.length).toBeGreaterThan(1);
    expect(legs[0].scheduledDeparture).toBe(startAt.toISOString());
    expect(new Date(legs[0].scheduledArrival).getTime()).toBe(
      startAt.getTime() + legs[0].estimatedMinutes * 60_000,
    );
    expect(new Date(legs[1].scheduledDeparture).getTime()).toBe(
      new Date(legs[0].scheduledArrival).getTime() + 45 * 60_000,
    );
  });

  it("compresses wall-clock flight time without changing operational duration", () => {
    const startAt = new Date("2026-07-22T08:00:00.000Z");
    const result = generateSchedule({
      startIcao: "LFPG", hubIcao: "LFPG", cruiseSpeedKts: 450, rangeNm: 3000,
      targetFlights: 2, targetRotations: 1, maxTotalMinutes: 600, maxLegMinutes: 180,
      returnToHub: true, airlineCode: "TL", startAt, groundMinutes: 45, timeScale: 12, seed: 42,
    });
    const first = result.rotations[0].legs[0];
    const wallClockMinutes = (new Date(first.scheduledArrival).getTime() - startAt.getTime()) / 60_000;
    expect(wallClockMinutes).toBeCloseTo(first.estimatedMinutes / 12, 5);
  });
});
