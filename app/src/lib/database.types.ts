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
export type AircraftLeaseStatus = "active" | "overdue" | "paid_off";
export type DispatchStatus =
  | "pending"
  | "dispatched"
  | "preflight"
  | "boarding"
  | "ready"
  | "flying"
  | "completed"
  | "cancelled";
export type CrewRank = "captain" | "first_officer" | "cabin_crew";
export type CrewStatus = "available" | "flying" | "resting";
export type ScheduleStatus = "planned" | "active" | "completed" | "cancelled";
export type ScheduleLegStatus = "planned" | "available" | "dispatched" | "flying" | "completed" | "cancelled";
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
  | "loan_received"
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
  current_airport_icao: string | null;
  created_at: string;
  updated_at: string;
};

export type UsedAircraftListing = {
  id: string;
  icao_type: string;
  model_name: string;
  registration: string;
  seller_name: string;
  manufacture_year: number;
  total_hours: number;
  cycles: number;
  health_pct: number;
  price: number;
  location_icao: string;
  status: "available" | "sold";
  sold_to_company_id: string | null;
  sold_at: string | null;
  owner_user_id: string | null;
  custom_catalog_id: string | null;
  custom_variant: number | null;
  created_at: string;
  updated_at: string;
};

export type NewAircraftCatalogItem = {
  id: string;
  icao_type: string;
  manufacturer: string;
  model_name: string;
  price: number;
  owner_user_id: string | null;
  specs: Json;
  created_at: string;
};

export type AircraftLease = {
  id: string;
  user_id: string;
  company_id: string;
  aircraft_id: string;
  listing_id: string;
  original_price: number;
  down_payment: number;
  financed_amount: number;
  monthly_payment: number;
  remaining_amount: number;
  interest_rate: number;
  total_months: number;
  paid_months: number;
  missed_payments: number;
  status: AircraftLeaseStatus;
  next_payment_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FlightSchedule = {
  id: string;
  user_id: string;
  company_id: string;
  aircraft_id: string;
  name: string;
  status: ScheduleStatus;
  start_airport_icao: string;
  hub_icao: string;
  max_flight_minutes: number;
  target_flights: number;
  target_rotations: number;
  return_to_hub: boolean;
  generation_settings: Json;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ScheduleRotation = {
  id: string;
  schedule_id: string;
  sequence: number;
  start_airport_icao: string;
  end_airport_icao: string;
  estimated_minutes: number;
  status: ScheduleStatus;
  created_at: string;
};

export type ScheduleLeg = {
  id: string;
  schedule_id: string;
  rotation_id: string;
  dispatch_id: string | null;
  sequence: number;
  origin_icao: string;
  dest_icao: string;
  distance_nm: number;
  estimated_minutes: number;
  flight_number: string;
  status: ScheduleLegStatus;
  created_at: string;
  completed_at: string | null;
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
      used_aircraft_listings: Table<UsedAircraftListing>;
      new_aircraft_catalog: Table<NewAircraftCatalogItem>;
      aircraft_leases:      Table<AircraftLease>;
      schedules:            Table<FlightSchedule>;
      schedule_rotations:   Table<ScheduleRotation>;
      schedule_legs:        Table<ScheduleLeg>;
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
    Functions: {
      buy_used_aircraft_listing: {
        Args: { p_listing_id: string; p_company_id: string };
        Returns: string;
      };
      buy_new_aircraft: {
        Args: { p_catalog_id: string; p_company_id: string };
        Returns: string;
      };
      lease_used_aircraft_listing: {
        Args: { p_listing_id: string; p_company_id: string; p_term_months: number };
        Returns: string;
      };
      buyout_aircraft_lease: {
        Args: { p_lease_id: string; p_company_id: string };
        Returns: undefined;
      };
      process_aircraft_lease_payments: {
        Args: { p_company_id: string; p_months: number };
        Returns: Json;
      };
      take_company_loan: {
        Args: {
          p_company_id: string;
          p_principal: number;
          p_monthly_payment: number;
          p_remaining_amount: number;
          p_total_months: number;
          p_interest_rate: number;
        };
        Returns: string;
      };
      sync_custom_aircraft_profile: {
        Args: { p_company_id: string; p_icao_type: string; p_model_name: string; p_manufacturer: string; p_mtow_kg: number; p_specs: Json };
        Returns: string;
      };
      remove_custom_aircraft_profile: {
        Args: { p_company_id: string; p_icao_type: string };
        Returns: undefined;
      };
    };
    Enums: {
      aircraft_ownership: AircraftOwnership;
      aircraft_lease_status: AircraftLeaseStatus;
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
