-- Shared second-hand aircraft market and atomic purchases.

create table public.used_aircraft_listings (
  id                 uuid primary key default gen_random_uuid(),
  icao_type          text not null,
  model_name         text not null,
  registration       text not null unique,
  seller_name        text not null,
  manufacture_year   integer not null check (manufacture_year between 1950 and 2100),
  total_hours        numeric(10, 1) not null check (total_hours >= 0),
  cycles             integer not null check (cycles >= 0),
  health_pct         numeric(5, 2) not null check (health_pct between 1 and 100),
  price              numeric(14, 2) not null check (price > 0),
  location_icao      text not null check (location_icao ~ '^[A-Z]{4}$'),
  status             text not null default 'available' check (status in ('available', 'sold')),
  sold_to_company_id uuid references public.companies(id) on delete set null,
  sold_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index used_aircraft_listings_available_idx
  on public.used_aircraft_listings(status, price);

create trigger used_aircraft_listings_set_updated_at
  before update on public.used_aircraft_listings
  for each row execute function public.set_updated_at();

alter table public.used_aircraft_listings enable row level security;

create policy "authenticated users view aircraft market"
  on public.used_aircraft_listings for select to authenticated
  using (true);

insert into public.used_aircraft_listings
  (id, icao_type, model_name, registration, seller_name, manufacture_year, total_hours, cycles, health_pct, price, location_icao)
values
  ('10000000-0000-4000-8000-000000000001', 'C172', 'Cessna 172 Skyhawk', 'N172TL', 'Rocky Mountain Aviation', 2008, 3840, 5210, 88, 285000, 'KDEN'),
  ('10000000-0000-4000-8000-000000000002', 'C208', 'Cessna 208B Grand Caravan', 'N208PX', 'Pacific Express', 2014, 6150, 4820, 82, 1850000, 'KSEA'),
  ('10000000-0000-4000-8000-000000000003', 'PC12', 'Pilatus PC-12/47E', 'HB-FLX', 'Alpine Charter', 2018, 2940, 2180, 93, 4750000, 'LSZH'),
  ('10000000-0000-4000-8000-000000000004', 'AT76', 'ATR 72-600', 'F-HATR', 'Hexagone Regional', 2016, 12840, 10110, 78, 14200000, 'LFPO'),
  ('10000000-0000-4000-8000-000000000005', 'E190', 'Embraer E190', 'PH-EXR', 'North Sea Connect', 2012, 24100, 16420, 71, 19800000, 'EHAM'),
  ('10000000-0000-4000-8000-000000000006', 'CRJ9', 'Bombardier CRJ-900', 'D-ACRX', 'Central Europe Air', 2011, 26750, 19280, 69, 12400000, 'EDDF'),
  ('10000000-0000-4000-8000-000000000007', 'A319', 'Airbus A319-100', 'G-EZTL', 'Albion Aircraft Trading', 2007, 38900, 24750, 64, 16800000, 'EGGW'),
  ('10000000-0000-4000-8000-000000000008', 'A320', 'Airbus A320-200', 'EC-MTL', 'Iberian Fleet Partners', 2013, 28100, 18120, 76, 28600000, 'LEMD'),
  ('10000000-0000-4000-8000-000000000009', 'B738', 'Boeing 737-800', 'EI-FTL', 'Emerald Leasing', 2010, 35200, 22400, 73, 27400000, 'EIDW'),
  ('10000000-0000-4000-8000-000000000010', 'B752', 'Boeing 757-200', 'N752CX', 'Atlantic Cargo Exchange', 1999, 61200, 32400, 58, 11800000, 'KJFK'),
  ('10000000-0000-4000-8000-000000000011', 'A332', 'Airbus A330-200', 'CS-TLX', 'Lusitania Widebody', 2008, 47800, 9420, 67, 38900000, 'LPPT'),
  ('10000000-0000-4000-8000-000000000012', 'B763', 'Boeing 767-300ER', 'N763GL', 'Great Lakes Aviation Assets', 2003, 58750, 13200, 61, 22900000, 'KORD');

create or replace function public.buy_used_aircraft_listing(
  p_listing_id uuid,
  p_company_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer public.companies%rowtype;
  listing public.used_aircraft_listings%rowtype;
  new_aircraft_id uuid;
begin
  select * into buyer from public.companies
  where id = p_company_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Company not found'; end if;

  select * into listing from public.used_aircraft_listings
  where id = p_listing_id
  for update;

  if not found or listing.status <> 'available' then
    raise exception 'This aircraft is no longer available';
  end if;
  if buyer.capital < listing.price then raise exception 'Insufficient capital'; end if;

  update public.companies set capital = capital - listing.price where id = buyer.id;

  insert into public.aircraft
    (user_id, company_id, name, icao_type, registration, health_pct, lease_cost_mo,
     total_hours, cycles, ownership, purchase_price, current_airport_icao)
  values
    (auth.uid(), buyer.id, listing.model_name, listing.icao_type, listing.registration,
     listing.health_pct, 0, listing.total_hours, listing.cycles, 'owned', listing.price,
     listing.location_icao)
  returning id into new_aircraft_id;

  insert into public.transactions (user_id, company_id, type, amount, description)
  values (auth.uid(), buyer.id, 'purchase', -listing.price,
          'Used aircraft purchase — ' || listing.model_name || ' (' || listing.registration || ')');

  update public.used_aircraft_listings
  set status = 'sold', sold_to_company_id = buyer.id, sold_at = now()
  where id = listing.id;

  return new_aircraft_id;
end;
$$;

revoke all on function public.buy_used_aircraft_listing(uuid, uuid) from public;
grant execute on function public.buy_used_aircraft_listing(uuid, uuid) to authenticated;
