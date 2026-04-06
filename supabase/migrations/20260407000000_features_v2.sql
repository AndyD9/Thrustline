-- ============================================================================
-- Thrustline — Features V2
--
-- Ajoute :
--   - Colonnes sur flights : landing_grade, planned_fuel_gal,
--     fuel_accuracy_pct, pax_satisfaction
--   - Table acars_reports (position reports en vol)
--   - Table achievements (badges/milestones)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Nouvelles colonnes sur flights
-- ---------------------------------------------------------------------------
alter table public.flights add column landing_grade text;
alter table public.flights add column planned_fuel_gal numeric(12, 2);
alter table public.flights add column fuel_accuracy_pct numeric(5, 2);
alter table public.flights add column pax_satisfaction numeric(5, 2);

-- ---------------------------------------------------------------------------
-- 2. Table acars_reports
-- ---------------------------------------------------------------------------
create table public.acars_reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  company_id       uuid not null references public.companies(id) on delete cascade,
  flight_id        uuid references public.flights(id) on delete cascade,
  dispatch_id      uuid not null references public.dispatches(id) on delete cascade,
  phase            text not null,
  latitude         double precision not null,
  longitude        double precision not null,
  altitude_ft      double precision not null,
  ground_speed_kts double precision not null,
  heading_deg      double precision not null,
  vs_fpm           double precision not null default 0,
  fuel_gal         double precision not null,
  message          text not null default '',
  created_at       timestamptz not null default now()
);

create index acars_reports_dispatch_idx on public.acars_reports(dispatch_id, created_at);
create index acars_reports_flight_idx   on public.acars_reports(flight_id);
create index acars_reports_user_idx     on public.acars_reports(user_id);

-- ---------------------------------------------------------------------------
-- 3. Table achievements
-- ---------------------------------------------------------------------------
create table public.achievements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  key          text not null,
  title        text not null,
  description  text not null default '',
  icon         text not null default 'trophy',
  unlocked_at  timestamptz not null default now(),
  flight_id    uuid references public.flights(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint achievements_unique unique (company_id, key)
);

create index achievements_company_idx on public.achievements(company_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.acars_reports enable row level security;
alter table public.achievements  enable row level security;

create policy "users manage own acars" on public.acars_reports
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own achievements" on public.achievements
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
