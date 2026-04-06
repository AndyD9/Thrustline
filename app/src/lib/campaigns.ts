/**
 * Marketing campaign definitions — 5 types of campaigns.
 */

export interface CampaignDef {
  type: string;
  name: string;
  icon: string;
  scope: "global" | "route";
  demandMultiplier: number;
  dailyCost: number;
  durationDays: number;
  description: string;
}

export const CAMPAIGNS: CampaignDef[] = [
  {
    type: "social_media",
    name: "Social Media Ads",
    icon: "megaphone",
    scope: "route",
    demandMultiplier: 1.15,
    dailyCost: 700,
    durationDays: 7,
    description: "Targeted social media advertising campaign boosting demand on a specific route.",
  },
  {
    type: "billboard",
    name: "Airport Billboard",
    icon: "monitor",
    scope: "global",
    demandMultiplier: 1.25,
    dailyCost: 1000,
    durationDays: 10,
    description: "Large billboard displays at your hub airport driving awareness globally.",
  },
  {
    type: "tv_commercial",
    name: "TV Commercial",
    icon: "tv",
    scope: "global",
    demandMultiplier: 1.20,
    dailyCost: 1800,
    durationDays: 14,
    description: "National TV advertising campaign reaching millions of potential travelers.",
  },
  {
    type: "loyalty_program",
    name: "Loyalty Program",
    icon: "heart",
    scope: "global",
    demandMultiplier: 1.10,
    dailyCost: 500,
    durationDays: 30,
    description: "Frequent flyer loyalty program building long-term customer retention.",
  },
  {
    type: "happy_hour",
    name: "Happy Hour Promo",
    icon: "zap",
    scope: "route",
    demandMultiplier: 1.30,
    dailyCost: 400,
    durationDays: 3,
    description: "Flash sale with steep discounts for a massive short-term demand spike.",
  },
];

/** Calculate total cost of a campaign. */
export function campaignTotalCost(def: CampaignDef): number {
  return def.dailyCost * def.durationDays;
}
