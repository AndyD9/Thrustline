-- ============================================================================
-- Thrustline — Supabase Cloud Schema
-- Mirrors the local SQLite Prisma schema with multi-tenant support
-- ============================================================================

-- Profiles (auto-populated from auth.users)
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users read own profile" on profiles
  for select using (id = auth.uid());
create policy "Users update own profile" on profiles
  for update using (id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = 'public';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- Domain tables
-- ============================================================================

create table companies (
  id                text primary key,
  name              text not null,
  capital           float8 not null default 1000000,
  hub_icao          text,
  active_aircraft_id text,
  airline_code      text not null default 'THL',
  simbrief_username text,
  onboarded         boolean not null default false,
  user_id           uuid not null references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table aircraft (
  id             text primary key,
  name           text not null,
  icao_type      text not null,
  health_pct     float8 not null default 100,
  lease_cost_mo  float8 not null,
  total_hours    float8 not null default 0,
  cycles         int not null default 0,
  ownership      text not null default 'leased',
  purchase_price float8,
  purchased_at   timestamptz,
  company_id     text not null references companies(id),
  user_id        uuid not null references profiles(id),
  updated_at     timestamptz not null default now()
);

create table flights (
  id              text primary key,
  departure_icao  text not null,
  arrival_icao    text not null,
  duration_min    int not null,
  fuel_used_gal   float8 not null,
  distance_nm     float8 not null,
  landing_vs_fpm  float8 not null,
  revenue         float8 not null default 0,
  fuel_cost       float8 not null default 0,
  landing_fee     float8 not null default 0,
  net_result      float8 not null default 0,
  company_id      text not null references companies(id),
  aircraft_id     text references aircraft(id),
  user_id         uuid not null references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table routes (
  id          text primary key,
  origin_icao text not null,
  dest_icao   text not null,
  distance_nm float8 not null,
  base_price  float8 not null,
  active      boolean not null default true,
  company_id  text not null references companies(id),
  user_id     uuid not null references profiles(id),
  updated_at  timestamptz not null default now()
);

create table dispatches (
  id             text primary key,
  flight_number  text not null,
  origin_icao    text not null,
  dest_icao      text not null,
  icao_type      text not null,
  distance_nm    float8 not null,
  eco_pax        int not null,
  biz_pax        int not null,
  cargo_kg       float8 not null,
  estim_fuel_lbs float8 not null,
  cruise_alt     int not null,
  status         text not null default 'pending',
  ofp_data       text,
  flight_id      text,
  aircraft_id    text,
  company_id     text not null references companies(id),
  user_id        uuid not null references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table crew_members (
  id          text primary key,
  first_name  text not null,
  last_name   text not null,
  rank        text not null default 'first_officer',
  experience  int not null default 1,
  salary_mo   float8 not null,
  duty_hours  float8 not null default 0,
  max_duty_h  float8 not null default 80,
  status      text not null default 'available',
  aircraft_id text references aircraft(id),
  company_id  text not null references companies(id),
  user_id     uuid not null references profiles(id),
  hired_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table loans (
  id               text primary key,
  principal        float8 not null,
  monthly_payment  float8 not null,
  remaining_amount float8 not null,
  total_months     int not null,
  paid_months      int not null default 0,
  interest_rate    float8 not null,
  company_id       text not null references companies(id),
  user_id          uuid not null references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table game_events (
  id          text primary key,
  type        text not null,
  scope       text not null,
  target_id   text,
  title       text not null,
  description text not null,
  modifier    float8 not null default 1.0,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  company_id  text not null references companies(id),
  user_id     uuid not null references profiles(id),
  updated_at  timestamptz not null default now()
);

create table reputations (
  id           text primary key,
  origin_icao  text not null,
  dest_icao    text not null,
  score        float8 not null default 50,
  flight_count int not null default 0,
  company_id   text not null references companies(id),
  user_id      uuid not null references profiles(id),
  updated_at   timestamptz not null default now(),
  unique(origin_icao, dest_icao, company_id)
);

create table transactions (
  id          text primary key,
  type        text not null,
  amount      float8 not null,
  description text not null,
  flight_id   text,
  company_id  text not null,
  user_id     uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security — all tables scoped to auth.uid()
-- ============================================================================

do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'companies', 'aircraft', 'flights', 'routes', 'dispatches',
    'crew_members', 'loans', 'game_events', 'reputations', 'transactions'
  ]) loop
    execute format('alter table %I enable row level security', tbl);
    execute format('create policy "Users select own %1$s" on %1$I for select using (user_id = auth.uid())', tbl);
    execute format('create policy "Users insert own %1$s" on %1$I for insert with check (user_id = auth.uid())', tbl);
    execute format('create policy "Users update own %1$s" on %1$I for update using (user_id = auth.uid())', tbl);
    execute format('create policy "Users delete own %1$s" on %1$I for delete using (user_id = auth.uid())', tbl);
  end loop;
end;
$$;

-- ============================================================================
-- Auto-update updated_at on every update
-- ============================================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'companies', 'aircraft', 'flights', 'routes', 'dispatches',
    'crew_members', 'loans', 'game_events', 'reputations', 'transactions'
  ]) loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function update_updated_at()',
      tbl
    );
  end loop;
end;
$$;
