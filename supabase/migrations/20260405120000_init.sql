-- ============================================================================
-- Thrustline — schéma initial Supabase (source de vérité unique)
--
-- Tables : companies, aircraft, flights, dispatches, routes, reputations,
--          crew_members, loans, game_events, transactions
--
-- Multi-tenant : chaque ligne porte user_id = auth.users(id).
-- RLS actif sur toutes les tables, policies "users manage own rows".
-- Le service_role (utilisé par sim-bridge .NET) contourne RLS automatiquement.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- pour gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.aircraft_ownership as enum ('leased', 'owned');
create type public.dispatch_status    as enum ('pending', 'dispatched', 'flying', 'completed', 'cancelled');
create type public.crew_rank          as enum ('captain', 'first_officer');
create type public.crew_status        as enum ('available', 'flying', 'resting');
create type public.game_event_type    as enum ('fuel_spike', 'fuel_drop', 'weather', 'tourism_boom', 'strike', 'mechanical');
create type public.game_event_scope   as enum ('global', 'route', 'aircraft');
create type public.transaction_type   as enum ('revenue', 'fuel', 'landing_fee', 'lease', 'maintenance', 'salary', 'purchase', 'sale', 'loan_payment');

-- ---------------------------------------------------------------------------
-- Helper: trigger updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ===========================================================================
-- companies
-- ===========================================================================
create table public.companies (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  airline_code        text not null,
  hub_icao            text not null,
  capital             numeric(14, 2) not null default 0,
  active_aircraft_id  uuid,
  simbrief_username   text,
  onboarded           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint companies_user_unique unique (user_id)
);

create index companies_user_id_idx on public.companies(user_id);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- aircraft
-- ===========================================================================
create table public.aircraft (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  icao_type       text not null,
  health_pct      numeric(5, 2) not null default 100 check (health_pct between 0 and 100),
  lease_cost_mo   numeric(14, 2) not null default 0,
  total_hours     numeric(10, 2) not null default 0,
  cycles          integer not null default 0,
  ownership       public.aircraft_ownership not null default 'leased',
  purchase_price  numeric(14, 2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index aircraft_company_idx on public.aircraft(company_id);
create index aircraft_user_idx    on public.aircraft(user_id);

create trigger aircraft_set_updated_at
  before update on public.aircraft
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- routes
-- ===========================================================================
create table public.routes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  origin_icao  text not null,
  dest_icao    text not null,
  distance_nm  numeric(10, 2) not null,
  base_price   numeric(14, 2) not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index routes_company_idx on public.routes(company_id);
create unique index routes_company_pair_idx
  on public.routes(company_id, origin_icao, dest_icao);

create trigger routes_set_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- reputations
-- ===========================================================================
create table public.reputations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  origin_icao   text not null,
  dest_icao     text not null,
  score         numeric(5, 2) not null default 50 check (score between 0 and 100),
  flight_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint reputations_route_unique unique (company_id, origin_icao, dest_icao)
);

create index reputations_company_idx on public.reputations(company_id);

create trigger reputations_set_updated_at
  before update on public.reputations
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- crew_members
-- ===========================================================================
create table public.crew_members (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  aircraft_id  uuid references public.aircraft(id) on delete set null,
  first_name   text not null,
  last_name    text not null,
  rank         public.crew_rank not null default 'first_officer',
  experience   integer not null default 0,
  salary_mo    numeric(12, 2) not null default 0,
  duty_hours   numeric(6, 2) not null default 0,
  max_duty_h   numeric(6, 2) not null default 80,
  status       public.crew_status not null default 'available',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index crew_members_company_idx  on public.crew_members(company_id);
create index crew_members_aircraft_idx on public.crew_members(aircraft_id);

create trigger crew_members_set_updated_at
  before update on public.crew_members
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- dispatches
-- ===========================================================================
create table public.dispatches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  aircraft_id     uuid references public.aircraft(id) on delete set null,
  flight_number   text not null,
  origin_icao     text not null,
  dest_icao       text not null,
  icao_type       text not null,
  pax_eco         integer not null default 0,
  pax_biz         integer not null default 0,
  cargo_kg        numeric(10, 2) not null default 0,
  estim_fuel_lbs  numeric(12, 2) not null default 0,
  cruise_alt      integer not null default 0,
  status          public.dispatch_status not null default 'pending',
  ofp_data        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index dispatches_company_status_idx on public.dispatches(company_id, status);

create trigger dispatches_set_updated_at
  before update on public.dispatches
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- flights
-- ===========================================================================
create table public.flights (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  company_id       uuid not null references public.companies(id) on delete cascade,
  aircraft_id      uuid references public.aircraft(id) on delete set null,
  dispatch_id      uuid references public.dispatches(id) on delete set null,
  departure_icao   text not null,
  arrival_icao     text not null,
  duration_min     integer not null default 0,
  fuel_used_gal    numeric(12, 2) not null default 0,
  distance_nm      numeric(10, 2) not null default 0,
  landing_vs_fpm   numeric(8, 2) not null default 0,
  revenue          numeric(14, 2) not null default 0,
  fuel_cost        numeric(14, 2) not null default 0,
  landing_fee      numeric(14, 2) not null default 0,
  net_result       numeric(14, 2) not null default 0,
  started_at       timestamptz not null,
  completed_at     timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index flights_company_completed_idx on public.flights(company_id, completed_at desc);
create index flights_aircraft_idx          on public.flights(aircraft_id);
create index flights_dispatch_idx          on public.flights(dispatch_id);

create trigger flights_set_updated_at
  before update on public.flights
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- loans
-- ===========================================================================
create table public.loans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  principal         numeric(14, 2) not null,
  monthly_payment   numeric(14, 2) not null,
  remaining_amount  numeric(14, 2) not null,
  total_months      integer not null,
  paid_months       integer not null default 0,
  interest_rate     numeric(6, 4) not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index loans_company_idx on public.loans(company_id);

create trigger loans_set_updated_at
  before update on public.loans
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- game_events
-- ===========================================================================
create table public.game_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  type          public.game_event_type not null,
  scope         public.game_event_scope not null default 'global',
  target_id     uuid,
  title         text not null,
  description   text not null default '',
  modifier      numeric(6, 3) not null default 1,
  starts_at     timestamptz not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index game_events_company_expires_idx on public.game_events(company_id, expires_at);

create trigger game_events_set_updated_at
  before update on public.game_events
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- transactions
-- ===========================================================================
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  flight_id    uuid references public.flights(id) on delete set null,
  type         public.transaction_type not null,
  amount       numeric(14, 2) not null,
  description  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index transactions_company_created_idx on public.transactions(company_id, created_at desc);
create index transactions_flight_idx          on public.transactions(flight_id);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FK différée : companies.active_aircraft_id -> aircraft.id
-- (ajout après la création des deux tables pour casser le cycle)
-- ---------------------------------------------------------------------------
alter table public.companies
  add constraint companies_active_aircraft_fk
  foreign key (active_aircraft_id)
  references public.aircraft(id)
  on delete set null
  deferrable initially deferred;

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.companies     enable row level security;
alter table public.aircraft      enable row level security;
alter table public.routes        enable row level security;
alter table public.reputations   enable row level security;
alter table public.crew_members  enable row level security;
alter table public.dispatches    enable row level security;
alter table public.flights       enable row level security;
alter table public.loans         enable row level security;
alter table public.game_events   enable row level security;
alter table public.transactions  enable row level security;

-- Pattern unique : l'utilisateur peut tout faire sur SES lignes.
-- Le service_role contourne automatiquement RLS (c'est le rôle utilisé par sim-bridge).

create policy "users manage own companies" on public.companies
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own aircraft" on public.aircraft
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own routes" on public.routes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own reputations" on public.reputations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own crew" on public.crew_members
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own dispatches" on public.dispatches
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own flights" on public.flights
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own loans" on public.loans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own game events" on public.game_events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own transactions" on public.transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
