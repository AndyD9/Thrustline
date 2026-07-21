/**
 * Achievement definitions — used by the frontend to render all possible achievements
 * (both locked and unlocked). The backend AchievementService mirrors these keys.
 */

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: "flight" | "landing" | "distance" | "time" | "financial" | "precision";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Flight milestones
  { key: "first_flight",        title: "First Flight",       description: "Complete your first flight",                      icon: "plane",    category: "flight" },
  { key: "ten_flights",         title: "Frequent Flyer",     description: "Complete 10 flights",                             icon: "plane",    category: "flight" },
  { key: "fifty_flights",       title: "Veteran Pilot",      description: "Complete 50 flights",                             icon: "award",    category: "flight" },
  { key: "hundred_flights",     title: "Sky Legend",          description: "Complete 100 flights",                            icon: "crown",    category: "flight" },

  // Landing quality
  { key: "first_greaser",       title: "Butter Landing",     description: "Land with less than 100 fpm",                     icon: "heart",    category: "landing" },
  { key: "fifty_greasers",      title: "Smooth Operator",    description: "50 landings under 100 fpm",                       icon: "zap",      category: "landing" },
  { key: "a_plus_landing",      title: "Perfection",         description: "Achieve an A+ landing grade",                     icon: "star",     category: "landing" },

  // Distance
  { key: "first_transatlantic", title: "Transatlantic",      description: "Fly a route longer than 1,500 nm",                icon: "globe",    category: "distance" },
  { key: "circumnavigator",     title: "Around the World",   description: "Accumulate 21,600+ nm total distance",            icon: "globe-2",  category: "distance" },

  // Time
  { key: "hundred_hours",       title: "Century",            description: "Fly 100+ total hours",                            icon: "clock",    category: "time" },
  { key: "thousand_hours",      title: "Thousand Hours",     description: "Fly 1,000+ total hours",                          icon: "timer",    category: "time" },

  // Routes
  { key: "five_routes",         title: "Route Explorer",     description: "Fly 5 unique routes",                             icon: "map",      category: "distance" },
  { key: "twenty_routes",       title: "Network Builder",    description: "Fly 20 unique routes",                            icon: "map-pin",  category: "distance" },

  // Financial
  { key: "millionaire",         title: "Millionaire",        description: "Reach $1,000,000 in capital",                     icon: "banknote", category: "financial" },

  // Precision
  { key: "perfect_fuel",        title: "Fuel Miser",         description: "Achieve 95%+ fuel accuracy on a flight",          icon: "fuel",     category: "precision" },
  { key: "pax_loved",           title: "Passenger Favorite", description: "Achieve 95+ passenger satisfaction on a flight",  icon: "smile",    category: "precision" },
];
