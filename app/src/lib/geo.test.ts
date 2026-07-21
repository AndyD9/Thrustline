import { describe, expect, it } from "vitest";
import { haversineNm } from "./geo";

describe("haversineNm", () => {
  it("returns zero for the same point", () => {
    expect(haversineNm(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it("calculates a known great-circle distance", () => {
    const parisToNewYork = haversineNm(49.0097, 2.5479, 40.6413, -73.7781);
    expect(parisToNewYork).toBeCloseTo(3150, 0);
  });

  it("is symmetric", () => {
    const outbound = haversineNm(51.47, -0.4543, 25.2532, 55.3657);
    const inbound = haversineNm(25.2532, 55.3657, 51.47, -0.4543);
    expect(outbound).toBeCloseTo(inbound, 10);
  });
});
