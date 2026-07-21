-- Public-release security hardening. Client applications are untrusted.

drop function if exists public.take_company_loan(uuid, numeric, numeric, numeric, integer, numeric);

create or replace function public.take_company_loan(p_company_id uuid, p_principal numeric, p_total_months integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  company_row public.companies%rowtype;
  active_debt numeric(14,2);
  interest_rate numeric(6,4);
  monthly_rate numeric;
  monthly_payment numeric(14,2);
  remaining_amount numeric(14,2);
  new_loan_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_principal < 10000 or p_total_months not in (12, 24, 36, 48) then
    raise exception 'Invalid loan amount or duration';
  end if;
  select * into company_row from public.companies
    where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  select coalesce(sum(remaining_amount), 0) into active_debt
    from public.loans where company_id = company_row.id and remaining_amount > 0;
  if company_row.capital <= 0 or p_principal + active_debt > company_row.capital * 3 then
    raise exception 'Loan exceeds borrowing limit';
  end if;
  interest_rate := least(18.0, 5.0 + active_debt / greatest(company_row.capital, 1) * 2.0);
  monthly_rate := interest_rate / 100 / 12;
  monthly_payment := round((p_principal * monthly_rate) / (1 - power(1 + monthly_rate, -p_total_months)), 2);
  remaining_amount := monthly_payment * p_total_months;
  insert into public.loans(user_id, company_id, principal, monthly_payment, remaining_amount,
    total_months, paid_months, interest_rate)
  values(auth.uid(), company_row.id, p_principal, monthly_payment, remaining_amount,
    p_total_months, 0, interest_rate) returning id into new_loan_id;
  update public.companies set capital = capital + p_principal where id = company_row.id;
  insert into public.transactions(user_id, company_id, type, amount, description)
  values(auth.uid(), company_row.id, 'loan_received', p_principal,
    format('Loan received — $%s over %s months at %s%% APR', p_principal, p_total_months, interest_rate));
  return new_loan_id;
end; $$;
revoke all on function public.take_company_loan(uuid, numeric, integer) from public;
grant execute on function public.take_company_loan(uuid, numeric, integer) to authenticated;

-- Hide the timestamp overload and expose server time only.
revoke all on function public.advance_passive_schedules(timestamptz) from public, anon, authenticated;
create or replace function public.advance_passive_schedules()
returns table(started integer, completed integer)
language sql security definer set search_path = public as $$
  select * from public.advance_passive_schedules(clock_timestamp())
$$;
revoke all on function public.advance_passive_schedules() from public;
grant execute on function public.advance_passive_schedules() to authenticated;

-- Protect economy columns from direct PostgREST updates. Privileged functions execute as postgres.
create or replace function public.guard_company_economy()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') and
    (new.capital is distinct from old.capital or new.global_reputation is distinct from old.global_reputation)
  then raise exception 'Protected company economy fields may only be changed by server operations'; end if;
  return new;
end; $$;
drop trigger if exists companies_guard_economy on public.companies;
create trigger companies_guard_economy before update on public.companies
for each row execute function public.guard_company_economy();

create or replace function public.guard_aircraft_economy()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') and (
    new.health_pct is distinct from old.health_pct or new.total_hours is distinct from old.total_hours or
    new.cycles is distinct from old.cycles or new.ownership is distinct from old.ownership or
    new.purchase_price is distinct from old.purchase_price or new.lease_cost_mo is distinct from old.lease_cost_mo or
    new.disposed_at is distinct from old.disposed_at
  ) then raise exception 'Protected aircraft economy fields may only be changed by server operations'; end if;
  return new;
end; $$;
drop trigger if exists aircraft_guard_economy on public.aircraft;
create trigger aircraft_guard_economy before update on public.aircraft
for each row execute function public.guard_aircraft_economy();

drop policy if exists "users manage own flights" on public.flights;
create policy "users read own flights" on public.flights for select to authenticated using (user_id = auth.uid());
drop policy if exists "users manage own transactions" on public.transactions;
create policy "users read own transactions" on public.transactions for select to authenticated using (user_id = auth.uid());
drop policy if exists "users manage own loans" on public.loans;
create policy "users read own loans" on public.loans for select to authenticated using (user_id = auth.uid());
drop policy if exists "users manage own reputations" on public.reputations;
create policy "users read own reputations" on public.reputations for select to authenticated using (user_id = auth.uid());

create table if not exists public.server_operations(
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  result jsonb,
  created_at timestamptz not null default now()
);
alter table public.server_operations enable row level security;
revoke all on table public.server_operations from anon, authenticated;

-- Atomic landing finalization. Only the Edge Function's service role may call it.
create or replace function public.complete_player_flight(
  p_operation_id uuid,
  p_user_id uuid,
  p_payload jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  existing_result jsonb;
  company_row public.companies%rowtype;
  dispatch_row public.dispatches%rowtype;
  aircraft_row public.aircraft%rowtype;
  reputation_row public.reputations%rowtype;
  new_flight_id uuid;
  distance_nm numeric(10,2);
  fuel_used numeric(12,2);
  landing_vs numeric(8,2);
  duration_minutes integer;
  pax_satisfaction numeric(5,2);
  rep_score numeric(6,2);
  rep_multiplier numeric;
  revenue_amount numeric(14,2);
  fuel_amount numeric(14,2);
  landing_amount numeric(14,2) := 500;
  net_amount numeric(14,2);
  wear numeric(6,2);
  grade text;
  result jsonb;
begin
  if p_operation_id is null or p_user_id is null then raise exception 'Missing operation identity'; end if;
  select result into existing_result from public.server_operations
    where id = p_operation_id and user_id = p_user_id and kind = 'complete_player_flight';
  if found then return existing_result; end if;

  distance_nm := round(greatest(0, least(20000, coalesce((p_payload->>'distanceNm')::numeric, 0))), 2);
  fuel_used := round(greatest(0, least(100000, coalesce((p_payload->>'fuelUsedGal')::numeric, 0))), 2);
  landing_vs := round(greatest(-3000, least(3000, coalesce((p_payload->>'landingVsFpm')::numeric, 0))), 2);
  duration_minutes := greatest(1, least(1440, coalesce((p_payload->>'durationMin')::integer, 1)));
  pax_satisfaction := round(greatest(0, least(100, coalesce((p_payload->>'paxSatisfaction')::numeric, 70))), 2);

  select * into company_row from public.companies where user_id = p_user_id for update;
  if not found then raise exception 'Company not found'; end if;
  select * into dispatch_row from public.dispatches
    where company_id = company_row.id and user_id = p_user_id and status = 'flying'
    order by updated_at desc limit 1 for update;
  if not found then raise exception 'No flying dispatch'; end if;
  if exists(select 1 from public.flights where dispatch_id = dispatch_row.id) then
    raise exception 'Dispatch already completed';
  end if;

  if dispatch_row.aircraft_id is not null then
    select * into aircraft_row from public.aircraft
      where id = dispatch_row.aircraft_id and company_id = company_row.id for update;
  end if;
  select * into reputation_row from public.reputations where company_id = company_row.id
    and origin_icao = dispatch_row.origin_icao and dest_icao = dispatch_row.dest_icao for update;
  rep_score := coalesce(reputation_row.score, 50);
  rep_multiplier := 0.5 + greatest(0, least(100, rep_score)) / 100;
  revenue_amount := round((dispatch_row.boarded_pax_eco + dispatch_row.boarded_pax_biz * 3)
    * 0.18 * distance_nm * rep_multiplier, 2);
  fuel_amount := round(fuel_used * 5.50, 2);
  net_amount := revenue_amount - fuel_amount - landing_amount;
  wear := round(0.08 + duration_minutes / 60.0 * 0.04 + case
    when abs(landing_vs) <= 300 then 0 when abs(landing_vs) <= 600 then 0.05
    when abs(landing_vs) <= 900 then 0.30 when abs(landing_vs) <= 1200 then 1
    when abs(landing_vs) <= 1500 then 3 else 6 end, 2);
  grade := case when abs(landing_vs) < 60 then 'A+' when abs(landing_vs) < 100 then 'A'
    when abs(landing_vs) < 150 then 'B+' when abs(landing_vs) < 200 then 'B'
    when abs(landing_vs) < 300 then 'C+' when abs(landing_vs) < 400 then 'C'
    when abs(landing_vs) < 600 then 'D' when abs(landing_vs) < 800 then 'D-'
    when abs(landing_vs) < 1000 then 'F+' else 'F' end;

  insert into public.flights(user_id, company_id, aircraft_id, dispatch_id, departure_icao,
    arrival_icao, duration_min, fuel_used_gal, distance_nm, landing_vs_fpm, revenue,
    fuel_cost, landing_fee, net_result, landing_grade, pax_satisfaction, pax_eco, pax_biz,
    load_factor_pct, maintenance_cost, operation_mode, started_at, completed_at)
  values(p_user_id, company_row.id, dispatch_row.aircraft_id, dispatch_row.id,
    dispatch_row.origin_icao, dispatch_row.dest_icao, duration_minutes, fuel_used, distance_nm,
    landing_vs, revenue_amount, fuel_amount, landing_amount, net_amount, grade, pax_satisfaction,
    dispatch_row.boarded_pax_eco, dispatch_row.boarded_pax_biz,
    case when dispatch_row.pax_eco + dispatch_row.pax_biz > 0 then round(
      (dispatch_row.boarded_pax_eco + dispatch_row.boarded_pax_biz) * 100.0 /
      (dispatch_row.pax_eco + dispatch_row.pax_biz), 2) else 0 end,
    0, 'player', now() - make_interval(mins => duration_minutes), now())
  returning id into new_flight_id;

  insert into public.transactions(user_id, company_id, flight_id, type, amount, description) values
    (p_user_id, company_row.id, new_flight_id, 'revenue', revenue_amount, 'Ticket sales ' || dispatch_row.flight_number),
    (p_user_id, company_row.id, new_flight_id, 'fuel', -fuel_amount, 'Fuel ' || dispatch_row.flight_number),
    (p_user_id, company_row.id, new_flight_id, 'landing_fee', -landing_amount, 'Landing fee ' || dispatch_row.dest_icao);
  update public.companies set capital = capital + net_amount where id = company_row.id;
  if aircraft_row.id is not null then
    update public.aircraft set health_pct = greatest(0, health_pct - wear), cycles = cycles + 1,
      total_hours = total_hours + duration_minutes / 60.0, current_airport_icao = dispatch_row.dest_icao
      where id = aircraft_row.id;
  end if;
  if reputation_row.id is null then
    insert into public.reputations(user_id, company_id, origin_icao, dest_icao, score, flight_count)
    values(p_user_id, company_row.id, dispatch_row.origin_icao, dispatch_row.dest_icao, 50, 1);
  else
    update public.reputations set score = greatest(0, least(100, score + case
      when abs(landing_vs) < 150 then 1 when abs(landing_vs) < 300 then 0.5
      when abs(landing_vs) < 600 then 0 when abs(landing_vs) < 1000 then -1 else -3 end)),
      flight_count = flight_count + 1 where id = reputation_row.id;
  end if;
  update public.dispatches set status = 'completed' where id = dispatch_row.id;

  insert into public.achievements(user_id, company_id, key, title, description, icon, flight_id)
    values(p_user_id, company_row.id, 'first_flight', 'First Flight', 'Complete your first flight', 'plane', new_flight_id)
    on conflict(company_id, key) do nothing;
  if abs(landing_vs) < 100 then
    insert into public.achievements(user_id, company_id, key, title, description, icon, flight_id)
      values(p_user_id, company_row.id, 'first_greaser', 'Butter Landing', 'Land with less than 100 fpm', 'heart', new_flight_id)
      on conflict(company_id, key) do nothing;
  end if;
  if grade = 'A+' then
    insert into public.achievements(user_id, company_id, key, title, description, icon, flight_id)
      values(p_user_id, company_row.id, 'a_plus_landing', 'Perfection', 'Achieve an A+ landing grade', 'star', new_flight_id)
      on conflict(company_id, key) do nothing;
  end if;

  update public.schedule_legs set status = 'completed', completed_at = now()
    where dispatch_id = dispatch_row.id;
  update public.schedule_legs next_leg set status = 'available' where next_leg.id = (
    select candidate.id from public.schedule_legs completed
    join public.schedule_legs candidate on candidate.schedule_id = completed.schedule_id
    where completed.dispatch_id = dispatch_row.id and candidate.sequence > completed.sequence
      and candidate.status = 'planned' order by candidate.sequence limit 1
  );

  result := jsonb_build_object('flightId', new_flight_id, 'grade', grade, 'revenue', revenue_amount,
    'fuelCost', fuel_amount, 'landingFee', landing_amount, 'netResult', net_amount,
    'paxSatisfaction', pax_satisfaction);
  insert into public.server_operations(id, user_id, kind, result)
    values(p_operation_id, p_user_id, 'complete_player_flight', result);
  return result;
end; $$;
revoke all on function public.complete_player_flight(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_player_flight(uuid, uuid, jsonb) to service_role;

-- Server-authoritative monthly billing.
create or replace function public.run_billing_cycle(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  company_row public.companies%rowtype;
  months integer;
  salaries numeric(14,2);
  legacy_leases numeric(14,2);
  loan_payments numeric(14,2);
  partnership_fees numeric(14,2);
  campaign_fees numeric(14,2);
  lease_result jsonb;
  lease_paid numeric(14,2);
  total_other numeric(14,2);
begin
  select * into company_row from public.companies
    where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  months := least(24, floor(extract(epoch from (now() - coalesce(company_row.last_billing_at, company_row.created_at))) / 2592000));
  if months <= 0 then return jsonb_build_object('monthsBilled', 0); end if;

  select coalesce(sum(salary_mo), 0) * months into salaries from public.crew_members where company_id = company_row.id;
  select coalesce(sum(a.lease_cost_mo), 0) * months into legacy_leases from public.aircraft a
    where a.company_id = company_row.id and a.ownership = 'leased'
      and not exists(select 1 from public.aircraft_leases l where l.aircraft_id = a.id);
  select coalesce(sum(least(monthly_payment * months, remaining_amount)), 0) into loan_payments
    from public.loans where company_id = company_row.id and remaining_amount > 0;
  select coalesce(sum(monthly_cost), 0) * months into partnership_fees
    from public.partnerships where company_id = company_row.id and active;
  select coalesce(sum(daily_cost * greatest(0, least(30 * months,
    extract(epoch from (least(expires_at, now()) - greatest(started_at, now() - make_interval(days => 30 * months)))) / 86400))), 0)
    into campaign_fees from public.marketing_campaigns
    where company_id = company_row.id and expires_at > now() - make_interval(days => 30 * months);

  lease_result := public.process_aircraft_lease_payments(company_row.id, months);
  lease_paid := coalesce((lease_result->>'total_paid')::numeric, 0);
  total_other := salaries + legacy_leases + loan_payments + partnership_fees + campaign_fees;

  update public.companies set capital = capital - total_other, last_billing_at = now() where id = company_row.id;
  update public.loans set paid_months = least(total_months, paid_months + months),
    remaining_amount = greatest(0, remaining_amount - monthly_payment * months)
    where company_id = company_row.id and remaining_amount > 0;
  if salaries > 0 then insert into public.transactions(user_id, company_id, type, amount, description)
    values(auth.uid(), company_row.id, 'salary', -salaries, format('Crew salaries — %s month(s)', months)); end if;
  if legacy_leases > 0 then insert into public.transactions(user_id, company_id, type, amount, description)
    values(auth.uid(), company_row.id, 'lease', -legacy_leases, format('Legacy aircraft leases — %s month(s)', months)); end if;
  if loan_payments > 0 then insert into public.transactions(user_id, company_id, type, amount, description)
    values(auth.uid(), company_row.id, 'loan_payment', -loan_payments, format('Loan payments — %s month(s)', months)); end if;
  if partnership_fees + campaign_fees > 0 then insert into public.transactions(user_id, company_id, type, amount, description)
    values(auth.uid(), company_row.id, 'maintenance', -(partnership_fees + campaign_fees), 'Partnership and marketing fees'); end if;

  return jsonb_build_object('monthsBilled', months, 'totalSalaries', salaries,
    'totalLeases', legacy_leases + lease_paid, 'totalLoanPayments', loan_payments,
    'totalPartnerships', partnership_fees, 'totalCampaigns', campaign_fees,
    'totalDeducted', total_other + lease_paid, 'leasePayments', lease_result);
end; $$;
revoke all on function public.run_billing_cycle(uuid) from public;
grant execute on function public.run_billing_cycle(uuid) to authenticated;

create or replace function public.purchase_marketing_campaign(
  p_company_id uuid, p_campaign_type text, p_duration_days integer,
  p_demand_multiplier numeric, p_daily_cost numeric, p_target_route text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare company_row public.companies%rowtype; campaign_id uuid; total_cost numeric(14,2);
begin
  if p_duration_days not between 1 and 90 or p_daily_cost <= 0 or p_demand_multiplier not between 1 and 3
    then raise exception 'Invalid campaign'; end if;
  select * into company_row from public.companies where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  total_cost := p_daily_cost * p_duration_days;
  if company_row.capital < total_cost then raise exception 'Insufficient capital'; end if;
  insert into public.marketing_campaigns(user_id, company_id, campaign_type, scope, target_route,
    demand_multiplier, daily_cost, started_at, expires_at)
  values(auth.uid(), company_row.id, left(p_campaign_type, 50), case when p_target_route is null then 'global' else 'route' end,
    p_target_route, p_demand_multiplier, p_daily_cost, now(), now() + make_interval(days => p_duration_days))
  returning id into campaign_id;
  update public.companies set capital = capital - total_cost where id = company_row.id;
  insert into public.transactions(user_id, company_id, type, amount, description)
    values(auth.uid(), company_row.id, 'maintenance', -total_cost, 'Marketing campaign purchase');
  return campaign_id;
end; $$;
revoke all on function public.purchase_marketing_campaign(uuid, text, integer, numeric, numeric, text) from public;
grant execute on function public.purchase_marketing_campaign(uuid, text, integer, numeric, numeric, text) to authenticated;

create or replace function public.cancel_marketing_campaign(p_company_id uuid, p_campaign_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare campaign public.marketing_campaigns%rowtype; refund numeric(14,2);
begin
  if not exists(select 1 from public.companies where id = p_company_id and user_id = auth.uid())
    then raise exception 'Company not found'; end if;
  select * into campaign from public.marketing_campaigns
    where id = p_campaign_id and company_id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Campaign not found'; end if;
  refund := round(campaign.daily_cost * greatest(0, ceil(extract(epoch from (campaign.expires_at - now())) / 86400)), 2);
  delete from public.marketing_campaigns where id = campaign.id;
  if refund > 0 then
    update public.companies set capital = capital + refund where id = p_company_id;
    insert into public.transactions(user_id, company_id, type, amount, description)
      values(auth.uid(), p_company_id, 'revenue', refund, 'Marketing campaign cancellation refund');
  end if;
  return refund;
end; $$;
revoke all on function public.cancel_marketing_campaign(uuid, uuid) from public;
grant execute on function public.cancel_marketing_campaign(uuid, uuid) to authenticated;

create or replace function public.toggle_partnership(p_company_id uuid, p_partner_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare existing public.partnerships%rowtype; enabled boolean; partner_name text;
  bonus_type text; bonus_value numeric; monthly_cost numeric;
begin
  if not exists(select 1 from public.companies where id = p_company_id and user_id = auth.uid())
    then raise exception 'Company not found'; end if;
  select * into existing from public.partnerships where company_id = p_company_id and partner_key = p_partner_key for update;
  if found then
    enabled := not existing.active;
    if enabled and (select count(*) from public.partnerships where company_id = p_company_id and active) >= 3
      then raise exception 'Maximum active partnerships reached'; end if;
    update public.partnerships set active = enabled where id = existing.id;
    return enabled;
  end if;
  if (select count(*) from public.partnerships where company_id = p_company_id and active) >= 3
    then raise exception 'Maximum active partnerships reached'; end if;
  select name, bonus, value, cost into partner_name, bonus_type, bonus_value, monthly_cost from (values
    ('fuel_supplier','SkyFuel Corp','fuel_discount',0.10::numeric,5000::numeric),
    ('mro_provider','AeroTech MRO','maintenance_discount',0.15,4000),
    ('catering','CloudKitchen Catering','pax_satisfaction',5.0,3000),
    ('gds_network','TravelLink GDS','demand_boost',0.10,6000),
    ('lounge_provider','EliteLounge Co','biz_demand',0.08,3500),
    ('cargo_handler','SwiftCargo Logistics','cargo_revenue',0.20,4000)
  ) as allowed(key,name,bonus,value,cost) where key = p_partner_key;
  if partner_name is null then raise exception 'Unknown partnership'; end if;
  insert into public.partnerships(user_id, company_id, partner_key, partner_name, bonus_type, bonus_value, monthly_cost, active)
    values(auth.uid(), p_company_id, p_partner_key, partner_name, bonus_type, bonus_value, monthly_cost, true);
  return true;
end; $$;
revoke all on function public.toggle_partnership(uuid, text) from public;
grant execute on function public.toggle_partnership(uuid, text) to authenticated;

drop policy if exists "users manage own achievements" on public.achievements;
create policy "users read own achievements" on public.achievements for select to authenticated using(user_id = auth.uid());
drop policy if exists "users manage own acars" on public.acars_reports;
create policy "users read own acars" on public.acars_reports for select to authenticated using(user_id = auth.uid());

drop policy if exists "users manage own campaigns" on public.marketing_campaigns;
create policy "users read own campaigns" on public.marketing_campaigns for select to authenticated using(user_id = auth.uid());
drop policy if exists "users manage own partnerships" on public.partnerships;
create policy "users read own partnerships" on public.partnerships for select to authenticated using(user_id = auth.uid());

create or replace function public.guard_aircraft_creation()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Aircraft creation and deletion require a server operation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists aircraft_guard_creation on public.aircraft;
create trigger aircraft_guard_creation before insert or delete on public.aircraft
for each row execute function public.guard_aircraft_creation();
