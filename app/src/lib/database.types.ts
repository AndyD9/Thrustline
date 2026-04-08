/**
 * Types TypeScript pour les tables Supabase de Thrustline.
 *
 * ⚠️ Ce fichier est écrit à la main pour démarrer. Dès que la base est appliquée,
 * le remplacer automatiquement par :
 *
 *    supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts
 *
 * ou en local :
 *
 *    supabase gen types typescript --local > src/lib/database.types.ts
 *
 * Miroir exact de supabase/migrations/20260405120000_init.sql.
 *
 * NOTE: On utilise `type` au lieu de `interface` pour que chaque Row satisfasse
 * `Record<string, unknown>` (index signature implicite), requis par postgrest-js
 * GenericTable à partir de v2.101+.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AircraftOwnership = "leased" | "owned";
export type DispatchStatus =
  | "pending"
  | "dispatched"
  | "flying"
  | "completed"
  | "cancelled";
export type CrewRank = "captain" | "first_officer" | "cabin_crew";
export type CrewStatus = "available" | "flying" | "resting";
export type GameEventType =
  | "fuel_spike"
  | "fuel_drop"
  | "weather"
  | "tourism_boom"
  | "strike"
  | "mechanical";
export type GameEventScope = "global" | "route" | "aircraft";
export type TransactionType =
  | "revenue"
  | "fuel"
  | "landing_fee"
  | "lease"
  | "maintenance"
  | "salary"
  | "purchase"
  | "sale"
  | "loan_payment";

export type Company = {
  id: string;
  user_id: string;
  name: string;
  airline_code: string;
  hub_icao: string;
  capital: number;
  active_aircraft_id: string | null;
  simbrief_username: string | null;
  onboarded: boolean;
  global_reputation: number;
  last_billing_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Aircraft = {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  icao_type: string;
  registration: string | null;
  simbrief_aircraft_id: string | null;
  health_pct: number;
  lease_cost_mo: number;
  total_hours: number;
  cycles: number;
  ownership: AircraftOwnership;
  purchase_price: number;
  created_at: string;
  updated_at: string;
};

export type Route = {
  id: string;
  user_id: string;
  company_id: string;
  origin_icao: string;
  dest_icao: string;
  distance_nm: number;
  base_price: number;
  price_modifier: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Reputation = {
  id: string;
  user_id: string;
  company_id: string;
  origin_icao: string;
  dest_icao: string;
  score: number;
  flight_count: number;
  created_at: string;
  updated_at: string;
};

export type CrewMember = {
  id: string;
  user_id: string;
  company_id: string;
  aircraft_id: string | null;
  first_name: string;
  last_name: string;
  rank: CrewRank;
  experience: number;
  salary_mo: number;
  duty_hours: number;
  max_duty_h: number;
  status: CrewStatus;
  created_at: string;
  updated_at: string;
};

export type Dispatch = {
  id: string;
  user_id: string;
  company_id: string;
  aircraft_id: string | null;
  flight_number: string;
  origin_icao: string;
  dest_icao: string;
  icao_type: string;
  pax_eco: number;
  pax_biz: number;
  cargo_kg: number;
  estim_fuel_lbs: number;
  cruise_alt: number;
  status: DispatchStatus;
  ofp_data: Json | null;
  created_at: string;
  updated_at: string;
};

export type Flight = {
  id: string;
  user_id: string;
  company_id: string;
  aircraft_id: string | null;
  dispatch_id: string | null;
  departure_icao: string;
  arrival_icao: string;
  duration_min: number;
  fuel_used_gal: number;
  distance_nm: number;
  landing_vs_fpm: number;
  revenue: number;
  fuel_cost: number;
  landing_fee: number;
  net_result: number;
  landing_grade: string | null;
  planned_fuel_gal: number | null;
  fuel_accuracy_pct: number | null;
  pax_satisfaction: number | null;
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
};

export type AcarsReport = {
  id: string;
  user_id: string;
  company_id: string;
  flight_id: string | null;
  dispatch_id: string;
  phase: string;
  latitude: number;
  longitude: number;
  altitude_ft: number;
  ground_speed_kts: number;
  heading_deg: number;
  vs_fpm: number;
  fuel_gal: number;
  message: string;
  created_at: string;
};

export type MarketingCampaign = {
  id: string;
  user_id: string;
  company_id: string;
  campaign_type: string;
  scope: string;
  target_route: string | null;
  demand_multiplier: number;
  daily_cost: number;
  started_at: string;
  expires_at: string;
  created_at: string;
};

export type Partnership = {
  id: string;
  user_id: string;
  company_id: string;
  partner_key: string;
  partner_name: string;
  bonus_type: string;
  bonus_value: number;
  monthly_cost: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Achievement = {
  id: string;
  user_id: string;
  company_id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked_at: string;
  flight_id: string | null;
  created_at: string;
};

export type Loan = {
  id: string;
  user_id: string;
  company_id: string;
  principal: number;
  monthly_payment: number;
  remaining_amount: number;
  total_months: number;
  paid_months: number;
  interest_rate: number;
  created_at: string;
  updated_at: string;
};

export type GameEvent = {
  id: string;
  user_id: string;
  company_id: string;
  type: GameEventType;
  scope: GameEventScope;
  target_id: string | null;
  title: string;
  description: string;
  modifier: number;
  starts_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  company_id: string;
  flight_id: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Shape attendue par @supabase/supabase-js createClient<Database>
//
// Le format doit respecter GenericSchema (postgrest-js v2.101+).
// Chaque table nécessite Row, Insert, Update et Relationships.
// ---------------------------------------------------------------------------
type Table<T> = {
  Row: T;
  Insert: Partial<T> & { id?: string };
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      companies:            Table<Company>;
      aircraft:             Table<Aircraft>;
      routes:               Table<Route>;
      reputations:          Table<Reputation>;
      crew_members:         Table<CrewMember>;
      dispatches:           Table<Dispatch>;
      flights:              Table<Flight>;
      loans:                Table<Loan>;
      game_events:          Table<GameEvent>;
      transactions:         Table<Transaction>;
      acars_reports:        Table<AcarsReport>;
      achievements:         Table<Achievement>;
      marketing_campaigns:  Table<MarketingCampaign>;
      partnerships:         Table<Partnership>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      aircraft_ownership: AircraftOwnership;
      dispatch_status: DispatchStatus;
      crew_rank: CrewRank;
      crew_status: CrewStatus;
      game_event_type: GameEventType;
      game_event_scope: GameEventScope;
      transaction_type: TransactionType;
    };
    CompositeTypes: Record<string, never>;
  };
};
