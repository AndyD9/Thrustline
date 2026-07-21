/**
 * Partnership definitions — 6 available partners with fictional names.
 * Max 3 active simultaneously.
 */

export interface PartnerDef {
  key: string;
  name: string;
  icon: string; // lucide icon name
  bonusType: string;
  bonusValue: number;
  bonusLabel: string;
  monthlyCost: number;
  description: string;
}

export const MAX_ACTIVE_PARTNERSHIPS = 3;

export const PARTNERS: PartnerDef[] = [
  {
    key: "fuel_supplier",
    name: "SkyFuel Corp",
    icon: "fuel",
    bonusType: "fuel_discount",
    bonusValue: 0.10,
    bonusLabel: "-10% fuel cost",
    monthlyCost: 5000,
    description: "Bulk jet fuel supply agreement with preferential pricing on all operations.",
  },
  {
    key: "mro_provider",
    name: "AeroTech MRO",
    icon: "wrench",
    bonusType: "maintenance_discount",
    bonusValue: 0.15,
    bonusLabel: "-15% wear & tear",
    monthlyCost: 4000,
    description: "Comprehensive maintenance program reducing aircraft wear on every landing cycle.",
  },
  {
    key: "catering",
    name: "CloudKitchen Catering",
    icon: "utensils",
    bonusType: "pax_satisfaction",
    bonusValue: 5.0,
    bonusLabel: "+5 pax satisfaction",
    monthlyCost: 3000,
    description: "Premium in-flight catering service boosting passenger comfort and satisfaction.",
  },
  {
    key: "gds_network",
    name: "TravelLink GDS",
    icon: "globe",
    bonusType: "demand_boost",
    bonusValue: 0.10,
    bonusLabel: "+10% demand",
    monthlyCost: 6000,
    description: "Global distribution system listing your flights on major booking platforms.",
  },
  {
    key: "lounge_provider",
    name: "EliteLounge Co",
    icon: "armchair",
    bonusType: "biz_demand",
    bonusValue: 0.08,
    bonusLabel: "+8% business class",
    monthlyCost: 3500,
    description: "Airport lounge access partnership attracting more business class travelers.",
  },
  {
    key: "cargo_handler",
    name: "SwiftCargo Logistics",
    icon: "package",
    bonusType: "cargo_revenue",
    bonusValue: 0.20,
    bonusLabel: "+20% cargo revenue",
    monthlyCost: 4000,
    description: "Cargo handling partnership opening new freight revenue streams.",
  },
];
