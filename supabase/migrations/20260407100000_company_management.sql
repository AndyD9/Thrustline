-- ============================================================================
-- Thrustline — Company Management
--
-- Ajoute :
--   - Table marketing_campaigns
--   - Table partnerships
--   - Colonne companies.global_reputation
--   - Colonne routes.price_modifier
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Marketing campaigns
-- ---------------------------------------------------------------------------
create table public.marketing_campaigns (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  campaign_type     text not null,
  scope             text not null default 'global',
  target_route      text,
  demand_multiplier numeric(4, 2) not null default 1.00,
  daily_cost        numeric(12, 2) not null default 0,
  started_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now()
);

create index campaigns_company_expires_idx on public.marketing_campaigns(company_id, expires_at);
create index campaigns_user_idx on public.marketing_campaigns(user_id);

-- ---------------------------------------------------------------------------
-- 2. Partnerships
-- ---------------------------------------------------------------------------
create table public.partnerships (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  partner_key   text not null,
  partner_name  text not null,
  bonus_type    text not null,
  bonus_value   numeric(5, 2) not null default 0,
  monthly_cost  numeric(12, 2) not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint partnerships_company_key_unique unique (company_id, partner_key)
);

create index partnerships_company_idx on public.partnerships(company_id);

create trigger partnerships_set_updated_at
  before update on public.partnerships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Nouvelles colonnes
-- ---------------------------------------------------------------------------
alter table public.companies add column global_reputation numeric(5, 2) not null default 50;
alter table public.routes add column price_modifier numeric(4, 2) not null default 1.00;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.marketing_campaigns enable row level security;
alter table public.partnerships enable row level security;

create policy "users manage own campaigns" on public.marketing_campaigns
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage own partnerships" on public.partnerships
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
