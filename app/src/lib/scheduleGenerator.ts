import { airports, airportByIcao, type Airport } from "@/data/airports";
import { haversineNm } from "@/lib/geo";

export interface ScheduleGeneratorInput {
  startIcao: string;
  hubIcao: string;
  cruiseSpeedKts: number;
  rangeNm: number;
  targetFlights: number;
  targetRotations: number;
  maxTotalMinutes: number;
  maxLegMinutes: number;
  returnToHub: boolean;
  airlineCode: string;
  startAt: Date;
  groundMinutes: number;
  timeScale: number;
  seed?: number;
}

export interface GeneratedScheduleLeg {
  sequence: number;
  rotationSequence: number;
  originIcao: string;
  destIcao: string;
  distanceNm: number;
  estimatedMinutes: number;
  flightNumber: string;
  scheduledDeparture: string;
  scheduledArrival: string;
}

export interface GeneratedScheduleRotation {
  sequence: number;
  startAirportIcao: string;
  endAirportIcao: string;
  estimatedMinutes: number;
  legs: GeneratedScheduleLeg[];
}

export interface GeneratedSchedule {
  rotations: GeneratedScheduleRotation[];
  totalMinutes: number;
  totalDistanceNm: number;
  finalAirportIcao: string;
  warnings: string[];
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function estimateMinutes(distanceNm: number, speedKts: number) {
  return Math.max(30, Math.round((distanceNm / speedKts) * 60 + 20));
}

function distanceBetween(from: Airport, to: Airport) {
  return Math.round(haversineNm(from.lat, from.lon, to.lat, to.lon));
}

function distributeLegs(flights: number, rotations: number) {
  const counts = Array.from({ length: rotations }, () => Math.floor(flights / rotations));
  for (let i = 0; i < flights % rotations; i += 1) counts[i] += 1;
  return counts;
}

export function generateSchedule(input: ScheduleGeneratorInput): GeneratedSchedule {
  const start = airportByIcao[input.startIcao];
  const hub = airportByIcao[input.hubIcao];
  if (!start || !hub) throw new Error("Unknown start airport or company hub.");
  if (input.targetRotations > input.targetFlights)
    throw new Error("The number of rotations cannot exceed the number of flights.");

  const random = seededRandom(input.seed ?? Date.now());
  const maxDistanceNm = Math.min(
    input.rangeNm * 0.9,
    Math.max(100, ((input.maxLegMinutes - 20) / 60) * input.cruiseSpeedKts),
  );
  const rotationSizes = distributeLegs(input.targetFlights, input.targetRotations);
  const rotations: GeneratedScheduleRotation[] = [];
  const warnings: string[] = [];
  const recentDestinations: string[] = [];
  let current = start;
  let totalMinutes = 0;
  let totalDistanceNm = 0;
  let sequence = 1;
  let nextDeparture = new Date(input.startAt);

  for (let rotationIndex = 0; rotationIndex < rotationSizes.length; rotationIndex += 1) {
    const rotationStart = current.icao;
    const legs: GeneratedScheduleLeg[] = [];
    const requestedLegs = rotationSizes[rotationIndex];

    for (let legIndex = 0; legIndex < requestedLegs; legIndex += 1) {
      const isFinalLeg = sequence === input.targetFlights;
      const mustReturnHome = isFinalLeg && input.returnToHub;
      let destination: Airport | undefined;

      if (mustReturnHome) {
        if (current.icao === hub.icao) {
          warnings.push("The aircraft was already at the hub before the final leg; the schedule contains one fewer flight.");
          break;
        }
        destination = hub;
      } else {
        const candidates = airports
          .map((airport) => {
            if (airport.icao === current.icao) return null;
            const distanceNm = distanceBetween(current, airport);
            if (distanceNm < 100 || distanceNm > maxDistanceNm) return null;
            const minutes = estimateMinutes(distanceNm, input.cruiseSpeedKts);
            if (minutes > input.maxLegMinutes || totalMinutes + minutes > input.maxTotalMinutes) return null;

            if (input.returnToHub) {
              const homeMinutes = airport.icao === hub.icao
                ? 0
                : estimateMinutes(distanceBetween(airport, hub), input.cruiseSpeedKts);
              if (totalMinutes + minutes + homeMinutes > input.maxTotalMinutes) return null;
              if (distanceBetween(airport, hub) > maxDistanceNm) return null;
            }

            const targetDistance = maxDistanceNm * 0.55;
            const distanceScore = 1 - Math.abs(distanceNm - targetDistance) / maxDistanceNm;
            const varietyPenalty = recentDestinations.includes(airport.icao) ? 0.55 : 0;
            const hubPenalty = airport.icao === hub.icao && !isFinalLeg ? 0.2 : 0;
            return { airport, score: distanceScore - varietyPenalty - hubPenalty + random() * 0.45 };
          })
          .filter((candidate): candidate is { airport: Airport; score: number } => candidate !== null)
          .sort((a, b) => b.score - a.score);
        destination = candidates[0]?.airport;
      }

      if (!destination) {
        warnings.push(`Generation stopped at ${current.icao}: no compatible destination remained within the limits.`);
        break;
      }

      const distanceNm = distanceBetween(current, destination);
      const estimatedMinutes = estimateMinutes(distanceNm, input.cruiseSpeedKts);
      if (estimatedMinutes > input.maxLegMinutes || totalMinutes + estimatedMinutes > input.maxTotalMinutes) {
        warnings.push(`The ${current.icao}-${destination.icao} leg would exceed the configured flight-time limit.`);
        break;
      }

      legs.push({
        sequence,
        rotationSequence: rotationIndex + 1,
        originIcao: current.icao,
        destIcao: destination.icao,
        distanceNm,
        estimatedMinutes,
        flightNumber: `${input.airlineCode}${String(sequence).padStart(3, "0")}`,
        scheduledDeparture: nextDeparture.toISOString(),
        scheduledArrival: new Date(nextDeparture.getTime() + estimatedMinutes / input.timeScale * 60_000).toISOString(),
      });
      nextDeparture = new Date(nextDeparture.getTime() + (estimatedMinutes + input.groundMinutes) / input.timeScale * 60_000);
      totalMinutes += estimatedMinutes;
      totalDistanceNm += distanceNm;
      recentDestinations.push(destination.icao);
      if (recentDestinations.length > 5) recentDestinations.shift();
      current = destination;
      sequence += 1;
    }

    if (legs.length > 0) {
      rotations.push({
        sequence: rotationIndex + 1,
        startAirportIcao: rotationStart,
        endAirportIcao: current.icao,
        estimatedMinutes: legs.reduce((sum, leg) => sum + leg.estimatedMinutes, 0),
        legs,
      });
    }
    if (sequence > input.targetFlights || legs.length < requestedLegs) break;
  }

  const generatedFlights = rotations.reduce((sum, rotation) => sum + rotation.legs.length, 0);
  if (generatedFlights < input.targetFlights)
    warnings.push(`${generatedFlights} of ${input.targetFlights} requested flights could be generated.`);
  if (input.returnToHub && current.icao !== hub.icao)
    warnings.push(`The aircraft ends at ${current.icao}; increase the hour or per-leg limit to return to ${hub.icao}.`);

  return { rotations, totalMinutes, totalDistanceNm, finalAirportIcao: current.icao, warnings };
}
