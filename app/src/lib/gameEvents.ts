// Random game event generator — creates world events that affect operations

import { supabase } from "./supabase";
import type { GameEventType, GameEventScope } from "./database.types";

interface EventTemplate {
  type: GameEventType;
  scope: GameEventScope;
  title: string;
  description: string;
  modifier: number; // multiplier (e.g., 1.3 = +30%, 0.7 = -30%)
  durationDays: [number, number]; // [min, max]
}

const TEMPLATES: EventTemplate[] = [
  // Fuel events
  { type: "fuel_spike", scope: "global", title: "Oil Price Surge", description: "Geopolitical tensions drive fuel prices up.", modifier: 1.30, durationDays: [3, 7] },
  { type: "fuel_spike", scope: "global", title: "Refinery Shortage", description: "Major refinery outage increases Jet-A prices.", modifier: 1.20, durationDays: [2, 5] },
  { type: "fuel_drop", scope: "global", title: "Oil Price Drop", description: "Oversupply in oil markets lowers fuel costs.", modifier: 0.80, durationDays: [3, 7] },
  { type: "fuel_drop", scope: "global", title: "New Trade Deal", description: "International agreement reduces fuel tariffs.", modifier: 0.85, durationDays: [5, 10] },

  // Tourism / demand
  { type: "tourism_boom", scope: "route", title: "Tourism Boom", description: "Viral social media post drives tourist demand.", modifier: 1.50, durationDays: [5, 14] },
  { type: "tourism_boom", scope: "global", title: "Holiday Season Rush", description: "Peak holiday period increases passenger demand globally.", modifier: 1.25, durationDays: [7, 14] },

  // Weather
  { type: "weather", scope: "route", title: "Severe Weather", description: "Storm system disrupts operations on this route.", modifier: 0.50, durationDays: [1, 3] },
  { type: "weather", scope: "global", title: "Volcanic Ash Cloud", description: "Volcanic activity disrupts European airspace.", modifier: 0.70, durationDays: [2, 5] },

  // Strike
  { type: "strike", scope: "global", title: "ATC Strike", description: "Air traffic controllers strike limits capacity.", modifier: 0.60, durationDays: [1, 3] },
  { type: "strike", scope: "route", title: "Airport Staff Strike", description: "Ground handling strike at a major airport.", modifier: 0.40, durationDays: [1, 2] },

  // Mechanical
  { type: "mechanical", scope: "aircraft", title: "Service Bulletin", description: "Manufacturer issues urgent service bulletin — extra maintenance required.", modifier: 0.90, durationDays: [3, 7] },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Maybe generate random events for a company.
 * Called during billing cycle. ~30% chance per month to generate 1-2 events.
 */
export async function maybeGenerateEvents(companyId: string, userId: string): Promise<number> {
  if (Math.random() > 0.30) return 0; // 70% chance nothing happens

  const count = Math.random() > 0.6 ? 2 : 1;
  const events: Array<{
    user_id: string;
    company_id: string;
    type: string;
    scope: string;
    target_id: string | null;
    title: string;
    description: string;
    modifier: number;
    starts_at: string;
    expires_at: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const template = pick(TEMPLATES);
    const durationDays = randInt(template.durationDays[0], template.durationDays[1]);
    const now = new Date();
    const expires = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    events.push({
      user_id: userId,
      company_id: companyId,
      type: template.type,
      scope: template.scope,
      target_id: null,
      title: template.title,
      description: template.description,
      modifier: template.modifier,
      starts_at: now.toISOString(),
      expires_at: expires.toISOString(),
    });
  }

  if (events.length > 0) {
    await supabase.from("game_events").insert(events);
  }

  return events.length;
}

/** Fetch currently active events for a company. */
export async function fetchActiveEvents(companyId: string) {
  const { data } = await supabase
    .from("game_events")
    .select("*")
    .eq("company_id", companyId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });
  return data ?? [];
}
