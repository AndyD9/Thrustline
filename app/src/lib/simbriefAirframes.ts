import { aircraftTypeByIcao, type AircraftType } from "@/data/aircraftTypes";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

const STORAGE_KEY = "thrustline.simbrief-airframes.v1";
const KG_PER_US_GALLON_JET_A = 3.039;

export interface ImportedAirframe extends AircraftType {
  source: "simbrief-share";
  importedAt: string;
  baseType: string;
  registration: string;
  engines: string;
  emptyWeightKg: number;
  maxZeroFuelKg: number;
  maxTakeoffKg: number;
  maxLandingKg: number;
  maxFuelKg: number;
  maxCargoKg: number;
  purchasePrice: number;
  leaseCostMo: number;
  maintenancePerHour: number;
  maintenanceFixedMo: number;
}

type SimBriefSharePayload = Record<string, unknown>;

function text(payload: SimBriefSharePayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function number(payload: SimBriefSharePayload, key: string): number {
  const value = Number(text(payload, key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function roundTo(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function inferManufacturer(icao: string): string {
  if (icao.startsWith("A")) return "Airbus";
  if (icao.startsWith("B")) return "Boeing";
  if (icao.startsWith("E")) return "Embraer";
  if (icao.startsWith("CRJ")) return "Bombardier";
  if (icao.startsWith("AT")) return "ATR";
  if (icao.startsWith("C")) return "Cessna";
  return "Other";
}

function engineCount(icao: string): number {
  if (/^(A34|A38|B74)/.test(icao)) return 4;
  if (/^(C172|C208|TBM|PC12)/.test(icao)) return 1;
  return 2;
}

function economyFor(icao: string, mtowKg: number) {
  const legacyQuad = /^(A34|B74)/.test(icao);
  let dollarsPerKg = mtowKg >= 300_000 ? 85 : mtowKg >= 150_000 ? 150 : mtowKg >= 70_000 ? 300 : 500;
  if (legacyQuad) dollarsPerKg = 60;

  const purchasePrice = roundTo(Math.max(500_000, mtowKg * dollarsPerKg), 100_000);
  const leaseCostMo = roundTo(purchasePrice * 0.015, 1_000);
  const maintenancePerHour = roundTo(mtowKg * 0.008 + engineCount(icao) * 400, 100);
  const maintenanceFixedMo = roundTo(purchasePrice * 0.0082, 5_000);
  return { purchasePrice, leaseCostMo, maintenancePerHour, maintenanceFixedMo };
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeSimBriefShareLink(rawLink: string): ImportedAirframe {
  let url: URL;
  try {
    url = new URL(rawLink.trim());
  } catch {
    throw new Error("Paste a complete SimBrief share link.");
  }

  if (url.hostname !== "dispatch.simbrief.com" || !url.pathname.startsWith("/airframes/share/")) {
    throw new Error("This is not a SimBrief airframe share link.");
  }

  const encoded = url.pathname.slice("/airframes/share/".length).split("/")[0];
  if (!encoded) throw new Error("The SimBrief link does not contain an airframe profile.");

  let payload: SimBriefSharePayload;
  try {
    payload = JSON.parse(decodeBase64Url(encoded)) as SimBriefSharePayload;
  } catch {
    throw new Error("The airframe data in this link could not be decoded.");
  }

  const icaoType = text(payload, "icao").toUpperCase();
  const name = text(payload, "name") || icaoType;
  const maxTakeoffKg = number(payload, "mtow");
  const maxPax = Math.round(number(payload, "maxpax"));
  if (!icaoType || icaoType.length > 4 || !maxTakeoffKg || !maxPax) {
    throw new Error("The profile is missing its ICAO type, MTOW, or passenger capacity.");
  }

  const existing = aircraftTypeByIcao[icaoType];
  const maxFuelKg = number(payload, "maxfuel");
  const economy = economyFor(icaoType, maxTakeoffKg);

  return {
    icaoType,
    name,
    manufacturer: existing?.manufacturer ?? inferManufacturer(icaoType),
    rangeNm: existing?.rangeNm ?? 0,
    maxPaxEco: maxPax,
    maxPaxBiz: 0,
    fuelCapacityGal: maxFuelKg ? Math.round(maxFuelKg / KG_PER_US_GALLON_JET_A) : (existing?.fuelCapacityGal ?? 0),
    ceilingFt: number(payload, "ceiling") || existing?.ceilingFt || 0,
    cruiseSpeedKts: existing?.cruiseSpeedKts ?? 450,
    minPilots: existing?.minPilots ?? (maxTakeoffKg > 12_500 ? 2 : 1),
    minCabin: existing?.minCabin ?? Math.ceil(maxPax / 50),
    source: "simbrief-share",
    importedAt: new Date().toISOString(),
    baseType: text(payload, "basetype").toUpperCase(),
    registration: text(payload, "reg").toUpperCase(),
    engines: text(payload, "engines"),
    emptyWeightKg: number(payload, "oew"),
    maxZeroFuelKg: number(payload, "mzfw"),
    maxTakeoffKg,
    maxLandingKg: number(payload, "mlw"),
    maxFuelKg,
    maxCargoKg: number(payload, "maxcargo"),
    ...economy,
  };
}

export function loadImportedAirframes(): ImportedAirframe[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is ImportedAirframe => (
      typeof item === "object" && item !== null && "icaoType" in item && "source" in item
    )) : [];
  } catch {
    return [];
  }
}

export function saveImportedAirframe(airframe: ImportedAirframe): void {
  const profiles = loadImportedAirframes().filter((item) => item.icaoType !== airframe.icaoType);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...profiles, airframe]));
  window.dispatchEvent(new Event("thrustline-airframes-changed"));
}

export function removeImportedAirframe(icaoType: string): void {
  const profiles = loadImportedAirframes().filter((item) => item.icaoType !== icaoType);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event("thrustline-airframes-changed"));
}

export async function syncImportedAirframe(companyId: string, airframe: ImportedAirframe): Promise<void> {
  const specs: Json = {
    rangeNm: airframe.rangeNm,
    maxPaxEco: airframe.maxPaxEco,
    maxPaxBiz: airframe.maxPaxBiz,
    cruiseSpeedKts: airframe.cruiseSpeedKts,
    ceilingFt: airframe.ceilingFt,
    maxTakeoffKg: airframe.maxTakeoffKg,
    engines: airframe.engines,
  };
  const { error } = await supabase.rpc("sync_custom_aircraft_profile", {
    p_company_id: companyId,
    p_icao_type: airframe.icaoType,
    p_model_name: airframe.name,
    p_manufacturer: airframe.manufacturer,
    p_mtow_kg: airframe.maxTakeoffKg,
    p_specs: specs,
  });
  if (error) throw error;
}

export async function removeSyncedAirframe(companyId: string, icaoType: string): Promise<void> {
  const { error } = await supabase.rpc("remove_custom_aircraft_profile", {
    p_company_id: companyId,
    p_icao_type: icaoType,
  });
  if (error) throw error;
}
