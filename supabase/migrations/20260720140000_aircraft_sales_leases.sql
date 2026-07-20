-- New aircraft catalogue and lease-to-own contracts for pre-owned aircraft.

create table public.new_aircraft_catalog (
  id text primary key,
  icao_type text not null unique,
  manufacturer text not null,
  model_name text not null,
  price numeric(14, 2) not null check (price > 0),
  created_at timestamptz not null default now()
);

alter table public.new_aircraft_catalog enable row level security;
create policy "authenticated users view new aircraft catalog"
  on public.new_aircraft_catalog for select to authenticated using (true);

insert into public.new_aircraft_catalog (id, icao_type, manufacturer, model_name, price) values
  ('c172', 'C172', 'Cessna', 'Cessna 172 Skyhawk', 480000),
  ('be58', 'BE58', 'Beechcraft', 'Baron G58', 1650000),
  ('c208', 'C208', 'Cessna', 'Grand Caravan EX', 2850000),
  ('tbm9', 'TBM9', 'Daher', 'TBM 930', 4950000),
  ('pc12', 'PC12', 'Pilatus', 'PC-12 NGX', 6850000),
  ('at76', 'AT76', 'ATR', 'ATR 72-600', 26500000),
  ('dh8d', 'DH8D', 'De Havilland', 'Dash 8 Q400', 32500000),
  ('crj7', 'CRJ7', 'Bombardier', 'CRJ-700', 41000000),
  ('crj9', 'CRJ9', 'Bombardier', 'CRJ-900', 51000000),
  ('e170', 'E170', 'Embraer', 'E170', 48000000),
  ('e190', 'E190', 'Embraer', 'E190', 60000000),
  ('e295', 'E295', 'Embraer', 'E195-E2', 73000000),
  ('a319', 'A319', 'Airbus', 'A319', 89000000),
  ('a320', 'A320', 'Airbus', 'A320', 101000000),
  ('a20n', 'A20N', 'Airbus', 'A320neo', 111000000),
  ('a321', 'A321', 'Airbus', 'A321', 118000000),
  ('b738', 'B738', 'Boeing', '737-800', 106000000),
  ('b38m', 'B38M', 'Boeing', '737 MAX 8', 121000000),
  ('a339', 'A339', 'Airbus', 'A330-900neo', 296000000),
  ('a359', 'A359', 'Airbus', 'A350-900', 318000000),
  ('b789', 'B789', 'Boeing', '787-9 Dreamliner', 293000000),
  ('b77w', 'B77W', 'Boeing', '777-300ER', 376000000),
  ('a388', 'A388', 'Airbus', 'A380-800', 445000000);

create type public.aircraft_lease_status as enum ('active', 'overdue', 'paid_off');

create table public.aircraft_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  aircraft_id uuid not null unique references public.aircraft(id) on delete cascade,
  listing_id uuid not null unique references public.used_aircraft_listings(id) on delete restrict,
  original_price numeric(14, 2) not null,
  down_payment numeric(14, 2) not null,
  financed_amount numeric(14, 2) not null,
  monthly_payment numeric(14, 2) not null,
  remaining_amount numeric(14, 2) not null,
  interest_rate numeric(6, 3) not null,
  total_months integer not null check (total_months in (12, 24, 36, 48)),
  paid_months integer not null default 0,
  missed_payments integer not null default 0,
  status public.aircraft_lease_status not null default 'active',
  next_payment_at timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index aircraft_leases_company_status_idx on public.aircraft_leases(company_id, status);
create trigger aircraft_leases_set_updated_at before update on public.aircraft_leases
  for each row execute function public.set_updated_at();
alter table public.aircraft_leases enable row level security;
create policy "users view own aircraft leases" on public.aircraft_leases
  for select to authenticated using (user_id = auth.uid());

create or replace function public.buy_new_aircraft(p_catalog_id text, p_company_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  buyer public.companies%rowtype;
  product public.new_aircraft_catalog%rowtype;
  aircraft_id uuid;
  generated_registration text;
begin
  select * into buyer from public.companies where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  select * into product from public.new_aircraft_catalog where id = p_catalog_id;
  if not found then raise exception 'Aircraft model not found'; end if;
  if buyer.capital < product.price then raise exception 'Insufficient capital'; end if;

  generated_registration := upper(buyer.airline_code) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  update public.companies set capital = capital - product.price where id = buyer.id;
  insert into public.aircraft
    (user_id, company_id, name, icao_type, registration, health_pct, lease_cost_mo,
     total_hours, cycles, ownership, purchase_price, current_airport_icao)
  values
    (auth.uid(), buyer.id, product.model_name, product.icao_type, generated_registration,
     100, 0, 0, 0, 'owned', product.price, buyer.hub_icao)
  returning id into aircraft_id;
  insert into public.transactions (user_id, company_id, type, amount, description)
  values (auth.uid(), buyer.id, 'purchase', -product.price,
          'New aircraft purchase — ' || product.model_name || ' (' || generated_registration || ')');
  return aircraft_id;
end; $$;

create or replace function public.lease_used_aircraft_listing(
  p_listing_id uuid, p_company_id uuid, p_term_months integer
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  buyer public.companies%rowtype;
  listing public.used_aircraft_listings%rowtype;
  aircraft_id uuid;
  down_payment numeric(14, 2);
  financed numeric(14, 2);
  apr numeric(6, 3);
  monthly_rate numeric;
  monthly_payment numeric(14, 2);
begin
  if p_term_months not in (12, 24, 36, 48) then raise exception 'Invalid lease duration'; end if;
  select * into buyer from public.companies where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  select * into listing from public.used_aircraft_listings where id = p_listing_id for update;
  if not found or listing.status <> 'available' then raise exception 'This aircraft is no longer available'; end if;

  down_payment := round(listing.price * 0.10, 2);
  if buyer.capital < down_payment then raise exception 'Insufficient capital for down payment'; end if;
  financed := listing.price - down_payment;
  apr := least(12.0, 6.0 + greatest(0, extract(year from current_date)::integer - listing.manufacture_year) * 0.08 + (100 - listing.health_pct) * 0.05);
  monthly_rate := apr / 100 / 12;
  monthly_payment := round((financed * monthly_rate) / (1 - power(1 + monthly_rate, -p_term_months)), 2);

  update public.companies set capital = capital - down_payment where id = buyer.id;
  insert into public.aircraft
    (user_id, company_id, name, icao_type, registration, health_pct, lease_cost_mo,
     total_hours, cycles, ownership, purchase_price, current_airport_icao)
  values
    (auth.uid(), buyer.id, listing.model_name, listing.icao_type, listing.registration,
     listing.health_pct, monthly_payment, listing.total_hours, listing.cycles, 'leased',
     listing.price, listing.location_icao)
  returning id into aircraft_id;

  insert into public.aircraft_leases
    (user_id, company_id, aircraft_id, listing_id, original_price, down_payment,
     financed_amount, monthly_payment, remaining_amount, interest_rate, total_months)
  values
    (auth.uid(), buyer.id, aircraft_id, listing.id, listing.price, down_payment,
     financed, monthly_payment, monthly_payment * p_term_months, apr, p_term_months);
  insert into public.transactions (user_id, company_id, type, amount, description)
  values (auth.uid(), buyer.id, 'lease', -down_payment,
          'Lease-to-own down payment — ' || listing.model_name || ' (' || listing.registration || ')');
  update public.used_aircraft_listings set status = 'sold', sold_to_company_id = buyer.id, sold_at = now()
    where id = listing.id;
  return aircraft_id;
end; $$;

create or replace function public.buyout_aircraft_lease(p_lease_id uuid, p_company_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  buyer public.companies%rowtype;
  contract public.aircraft_leases%rowtype;
  aircraft_name text;
begin
  select * into buyer from public.companies where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  select * into contract from public.aircraft_leases
    where id = p_lease_id and company_id = buyer.id and status <> 'paid_off' for update;
  if not found then raise exception 'Active lease not found'; end if;
  if buyer.capital < contract.remaining_amount then raise exception 'Insufficient capital'; end if;
  select name into aircraft_name from public.aircraft where id = contract.aircraft_id;
  update public.companies set capital = capital - contract.remaining_amount where id = buyer.id;
  update public.aircraft_leases set remaining_amount = 0, paid_months = total_months,
    status = 'paid_off', completed_at = now() where id = contract.id;
  update public.aircraft set ownership = 'owned', lease_cost_mo = 0 where id = contract.aircraft_id;
  insert into public.transactions (user_id, company_id, type, amount, description)
  values (auth.uid(), buyer.id, 'purchase', -contract.remaining_amount,
          'Lease buyout — ' || aircraft_name);
end; $$;

create or replace function public.process_aircraft_lease_payments(p_company_id uuid, p_months integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  buyer public.companies%rowtype;
  contract public.aircraft_leases%rowtype;
  payment numeric(14, 2);
  total_paid numeric(14, 2) := 0;
  paid_count integer := 0;
  overdue_count integer := 0;
  i integer;
begin
  if p_months < 1 or p_months > 24 then raise exception 'Invalid billing period'; end if;
  select * into buyer from public.companies where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;

  for i in 1..p_months loop
    for contract in select * from public.aircraft_leases
      where company_id = buyer.id and status in ('active', 'overdue') order by created_at for update
    loop
      payment := least(contract.monthly_payment, contract.remaining_amount);
      if buyer.capital >= payment then
        buyer.capital := buyer.capital - payment;
        total_paid := total_paid + payment;
        paid_count := paid_count + 1;
        update public.aircraft_leases set
          remaining_amount = greatest(0, remaining_amount - payment),
          paid_months = paid_months + 1,
          status = case when remaining_amount - payment <= 0 then 'paid_off'::public.aircraft_lease_status else 'active'::public.aircraft_lease_status end,
          next_payment_at = next_payment_at + interval '30 days',
          completed_at = case when remaining_amount - payment <= 0 then now() else completed_at end
        where id = contract.id;
        if contract.remaining_amount - payment <= 0 then
          update public.aircraft set ownership = 'owned', lease_cost_mo = 0 where id = contract.aircraft_id;
        end if;
        insert into public.transactions (user_id, company_id, type, amount, description)
        values (auth.uid(), buyer.id, 'lease', -payment,
                'Lease-to-own payment — month ' || (contract.paid_months + 1) || '/' || contract.total_months);
      else
        overdue_count := overdue_count + 1;
        update public.aircraft_leases set status = 'overdue', missed_payments = missed_payments + 1
          where id = contract.id;
      end if;
    end loop;
  end loop;
  update public.companies set capital = buyer.capital where id = buyer.id;
  return jsonb_build_object('total_paid', total_paid, 'payments', paid_count, 'overdue', overdue_count);
end; $$;

create or replace function public.prevent_overdue_aircraft_dispatch()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'flying' and exists (
    select 1 from public.aircraft_leases where aircraft_id = new.aircraft_id and status = 'overdue'
  ) then raise exception 'Aircraft lease payment is overdue'; end if;
  return new;
end; $$;

create trigger dispatch_prevent_overdue_lease
  before insert or update of status, aircraft_id on public.dispatches
  for each row execute function public.prevent_overdue_aircraft_dispatch();

revoke all on function public.buy_new_aircraft(text, uuid) from public;
revoke all on function public.lease_used_aircraft_listing(uuid, uuid, integer) from public;
revoke all on function public.buyout_aircraft_lease(uuid, uuid) from public;
revoke all on function public.process_aircraft_lease_payments(uuid, integer) from public;
grant execute on function public.buy_new_aircraft(text, uuid) to authenticated;
grant execute on function public.lease_used_aircraft_listing(uuid, uuid, integer) to authenticated;
grant execute on function public.buyout_aircraft_lease(uuid, uuid) to authenticated;
grant execute on function public.process_aircraft_lease_payments(uuid, integer) to authenticated;
