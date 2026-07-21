import { describe, expect, it } from "vitest";
import { getFormatters, imperialFormatters, metricFormatters } from "./units";

describe("unit formatters", () => {
  it("keeps simulator values in aviation units for imperial display", () => {
    expect(imperialFormatters.fuel(1234.4)).toBe("1,234 gal");
    expect(imperialFormatters.altitude(35000)).toBe("35,000 ft");
    expect(imperialFormatters.speed(250)).toBe("250 kt");
  });

  it("converts simulator values for metric display", () => {
    expect(metricFormatters.weight(1000)).toBe("454 kg");
    expect(metricFormatters.distance(100)).toBe("185 km");
    expect(metricFormatters.vs(-500)).toBe("-2.5 m/s");
  });

  it("selects the requested unit system", () => {
    expect(getFormatters("imperial")).toBe(imperialFormatters);
    expect(getFormatters("metric")).toBe(metricFormatters);
  });
});
