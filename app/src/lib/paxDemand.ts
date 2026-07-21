// Dynamic passenger demand engine
// Computes realistic pax count based on route, season, time, reputation, and randomness

import type { Airport } from "@/data/airports";
import type { AircraftType } from "@/data/aircraftTypes";

export interface PaxDemand {
  eco: number;
  biz: number;
  loadFactor: number; // 0-1
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Compute distance factor: short-haul fills more easily. */
function distanceFactor(distanceNm: number): number {
  if (distanceNm < 500) return 1.10;      // short-haul: high demand
  if (distanceNm < 1500) return 1.00;     // medium-haul: baseline
  if (distanceNm < 3000) return 0.95;     // long-haul: slightly lower fill
  return 0.90;                             // ultra-long-haul: harder to fill
}

/** Hub premium: international airports generate more traffic. */
function hubFactor(origin: Airport, dest: Airport): number {
  const isHub = (a: Airport) =>
    a.name.toLowerCase().includes("international") ||
    a.name.toLowerCase().includes("intl") ||
    (a.iata.length === 3 && a.iata !== "");
  const originHub = isHub(origin);
  const destHub = isHub(dest);
  if (originHub && destHub) return 1.15;   // both hubs: strong demand
  if (originHub || destHub) return 1.08;   // one hub
  return 0.90;                              // regional-regional: lower demand
}

/** Seasonal factor based on destination latitude and month. */
function seasonFactor(destLat: number, month: number): number {
  const isTropical = Math.abs(destLat) < 23.5;
  if (isTropical) return 1.10; // tropical = year-round tourism boost

  const isNorthernHemisphere = destLat > 0;
  // Summer months (high season)
  const summerMonths = isNorthernHemisphere ? [5, 6, 7, 8] : [11, 0, 1, 2]; // 0-indexed
  // Shoulder months
  const shoulderMonths = isNorthernHemisphere ? [3, 4, 9, 10] : [3, 4, 9, 10];

  if (summerMonths.includes(month)) return 1.15;    // peak season
  if (shoulderMonths.includes(month)) return 1.00;  // shoulder
  return 0.85;                                        // low season
}

/** Time-of-day factor: business hours fill better. */
function timeFactor(hour: number): number {
  if (hour >= 6 && hour <= 9) return 1.10;    // morning rush
  if (hour >= 17 && hour <= 20) return 1.10;   // evening rush
  if (hour >= 10 && hour <= 16) return 1.00;   // midday
  if (hour >= 21 && hour <= 23) return 0.85;   // late evening
  return 0.70;                                  // red-eye / night
}

/** Reputation factor: 0-100 score → 0.5x to 1.5x multiplier. */
function reputationFactor(score: number): number {
  return 0.5 + (clamp(score, 0, 100) / 100);
}

/** Random market variation: ±15%. */
function randomFactor(): number {
  return 0.85 + Math.random() * 0.30;
}

/**
 * Compute dynamic passenger demand for a dispatch.
 * Returns pax counts capped to aircraft max capacity.
 */
export function computePaxDemand(opts: {
  origin: Airport;
  dest: Airport;
  aircraftType: AircraftType;
  distanceNm: number;
  reputationScore?: number;
  date?: Date;
  /** Multiplier from marketing campaigns + GDS partnership (default 1.0) */
  campaignMultiplier?: number;
  /** Route price modifier: >1 = premium (less pax), <1 = discount (more pax) */
  priceModifier?: number;
}): PaxDemand {
  const {
    origin,
    dest,
    aircraftType,
    distanceNm,
    reputationScore = 50,
    date = new Date(),
    campaignMultiplier = 1.0,
    priceModifier = 1.0,
  } = opts;

  const baseLF = 0.70;
  const dist = distanceFactor(distanceNm);
  const hub = hubFactor(origin, dest);
  const season = seasonFactor(dest.lat, date.getMonth());
  const time = timeFactor(date.getHours());
  const rep = reputationFactor(reputationScore);
  const rand = randomFactor();
  // Price effect: premium pricing reduces pax, discount increases
  // priceModifier 1.3 (premium) → priceFactor ~0.85, priceModifier 0.8 (discount) → ~1.12
  const priceFactor = clamp(1 / priceModifier * 0.5 + 0.5, 0.70, 1.30);
  const campaign = clamp(campaignMultiplier, 1.0, 2.0);

  const loadFactor = clamp(baseLF * dist * hub * season * time * rep * rand * priceFactor * campaign, 0.20, 0.98);

  // Business class fills at ~60% of economy load factor
  const bizLoadFactor = clamp(loadFactor * 0.6, 0.10, 0.90);

  const eco = Math.round(aircraftType.maxPaxEco * loadFactor);
  const biz = Math.round(aircraftType.maxPaxBiz * bizLoadFactor);

  return {
    eco: Math.min(eco, aircraftType.maxPaxEco),
    biz: Math.min(biz, aircraftType.maxPaxBiz),
    loadFactor,
  };
}
