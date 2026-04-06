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

export interface Company {
  id: string;
  user_id: string;
  name: string;
  airline_code: string;
  hub_icao: string;
  capital: number;
  active_aircraft_id: string | null;
  simbrief_username: string | null;
  onboarded: boolean;
  last_billing_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Aircraft {
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
}

export interface Route {
  id: string;
  user_id: string;
  company_id: string;
  origin_icao: string;
  dest_icao: string;
  distance_nm: number;
  base_price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reputation {
  id: string;
  user_id: string;
  company_id: string;
  origin_icao: string;
  dest_icao: string;
  score: number;
  flight_count: number;
  created_at: string;
  updated_at: string;
}

export interface CrewMember {
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
}

export interface Dispatch {
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
}

export interface Flight {
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
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface Loan {
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
}

export interface GameEvent {
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
}

export interface Transaction {
  id: string;
  user_id: string;
  company_id: string;
  flight_id: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Shape attendue par @supabase/supabase-js createClient<Database>
// ---------------------------------------------------------------------------
type Row<T> = T;
type Insert<T> = Partial<T> & { id?: string };
type Update<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      companies:    { Row: Row<Company>;     Insert: Insert<Company>;     Update: Update<Company> };
      aircraft:     { Row: Row<Aircraft>;    Insert: Insert<Aircraft>;    Update: Update<Aircraft> };
      routes:       { Row: Row<Route>;       Insert: Insert<Route>;       Update: Update<Route> };
      reputations:  { Row: Row<Reputation>;  Insert: Insert<Reputation>;  Update: Update<Reputation> };
      crew_members: { Row: Row<CrewMember>;  Insert: Insert<CrewMember>;  Update: Update<CrewMember> };
      dispatches:   { Row: Row<Dispatch>;    Insert: Insert<Dispatch>;    Update: Update<Dispatch> };
      flights:      { Row: Row<Flight>;      Insert: Insert<Flight>;      Update: Update<Flight> };
      loans:        { Row: Row<Loan>;        Insert: Insert<Loan>;        Update: Update<Loan> };
      game_events:  { Row: Row<GameEvent>;   Insert: Insert<GameEvent>;   Update: Update<GameEvent> };
      transactions: { Row: Row<Transaction>; Insert: Insert<Transaction>; Update: Update<Transaction> };
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
  };
}
