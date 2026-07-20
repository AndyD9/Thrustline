-- User-imported SimBrief profiles become private new and pre-owned market offers.

alter table public.new_aircraft_catalog
  add column owner_user_id uuid references auth.users(id) on delete cascade,
  add column specs jsonb not null default '{}'::jsonb;
alter table public.new_aircraft_catalog drop constraint new_aircraft_catalog_icao_type_key;

drop policy "authenticated users view new aircraft catalog" on public.new_aircraft_catalog;
create policy "users view public and own new aircraft catalog"
  on public.new_aircraft_catalog for select to authenticated
  using (owner_user_id is null or owner_user_id = auth.uid());

alter table public.used_aircraft_listings
  add column owner_user_id uuid references auth.users(id) on delete cascade,
  add column custom_catalog_id text references public.new_aircraft_catalog(id) on delete set null,
  add column custom_variant integer;

create unique index used_aircraft_custom_variant_idx
  on public.used_aircraft_listings(custom_catalog_id, custom_variant)
  where custom_catalog_id is not null;

drop policy "authenticated users view aircraft market" on public.used_aircraft_listings;
create policy "users view public and own aircraft market"
  on public.used_aircraft_listings for select to authenticated
  using (owner_user_id is null or owner_user_id = auth.uid());

create or replace function public.sync_custom_aircraft_profile(
  p_company_id uuid,
  p_icao_type text,
  p_model_name text,
  p_manufacturer text,
  p_mtow_kg numeric,
  p_specs jsonb
)
returns text language plpgsql security definer set search_path = public as $$
declare
  buyer public.companies%rowtype;
  catalog_id text;
  price_per_kg numeric;
  catalog_price numeric(14, 2);
  registration_prefix text;
begin
  select * into buyer from public.companies where id = p_company_id and user_id = auth.uid();
  if not found then raise exception 'Company not found'; end if;
  if p_icao_type !~ '^[A-Z0-9]{2,4}$' or p_mtow_kg <= 0 then raise exception 'Invalid aircraft profile'; end if;

  price_per_kg := case when p_mtow_kg >= 300000 then 85 when p_mtow_kg >= 150000 then 150 when p_mtow_kg >= 70000 then 300 else 500 end;
  if p_icao_type ~ '^(A34|B74)' then price_per_kg := 60; end if;
  catalog_price := round(greatest(500000, p_mtow_kg * price_per_kg) / 100000) * 100000;
  catalog_id := 'custom:' || auth.uid()::text || ':' || lower(p_icao_type);
  registration_prefix := upper(substr(regexp_replace(p_icao_type, '[^A-Z0-9]', '', 'g'), 1, 3));

  insert into public.new_aircraft_catalog
    (id, icao_type, manufacturer, model_name, price, owner_user_id, specs)
  values
    (catalog_id, upper(p_icao_type), left(p_manufacturer, 80), left(p_model_name, 120), catalog_price, auth.uid(), p_specs)
  on conflict (id) do update set
    manufacturer = excluded.manufacturer, model_name = excluded.model_name,
    price = excluded.price, specs = excluded.specs;

  insert into public.used_aircraft_listings
    (icao_type, model_name, registration, seller_name, manufacture_year, total_hours,
     cycles, health_pct, price, location_icao, owner_user_id, custom_catalog_id, custom_variant)
  values
    (upper(p_icao_type), left(p_model_name, 120), registration_prefix || '-' || upper(substr(md5(auth.uid()::text || p_icao_type || '1'), 1, 5)),
     'Certified pre-owned network', extract(year from current_date)::integer - 10, 4500, 3200, 84,
     round(catalog_price * 0.72 / 10000) * 10000, buyer.hub_icao, auth.uid(), catalog_id, 1),
    (upper(p_icao_type), left(p_model_name, 120), registration_prefix || '-' || upper(substr(md5(auth.uid()::text || p_icao_type || '2'), 1, 5)),
     'Independent aircraft broker', extract(year from current_date)::integer - 20, 13500, 9100, 68,
     round(catalog_price * 0.52 / 10000) * 10000, buyer.hub_icao, auth.uid(), catalog_id, 2)
  on conflict (custom_catalog_id, custom_variant) where custom_catalog_id is not null do update set
    model_name = excluded.model_name, price = excluded.price, location_icao = excluded.location_icao,
    status = case when public.used_aircraft_listings.status = 'sold' then 'sold' else 'available' end;

  return catalog_id;
end; $$;

create or replace function public.remove_custom_aircraft_profile(p_company_id uuid, p_icao_type text)
returns void language plpgsql security definer set search_path = public as $$
declare catalog_id text;
begin
  if not exists (select 1 from public.companies where id = p_company_id and user_id = auth.uid()) then
    raise exception 'Company not found';
  end if;
  catalog_id := 'custom:' || auth.uid()::text || ':' || lower(p_icao_type);
  delete from public.used_aircraft_listings where custom_catalog_id = catalog_id and status = 'available';
  delete from public.new_aircraft_catalog where id = catalog_id and owner_user_id = auth.uid();
end; $$;

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
  select * into product from public.new_aircraft_catalog
    where id = p_catalog_id and (owner_user_id is null or owner_user_id = auth.uid());
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

create or replace function public.buy_used_aircraft_listing(p_listing_id uuid, p_company_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare buyer public.companies%rowtype; listing public.used_aircraft_listings%rowtype; new_aircraft_id uuid;
begin
  select * into buyer from public.companies where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  select * into listing from public.used_aircraft_listings where id = p_listing_id for update;
  if not found or listing.status <> 'available' or (listing.owner_user_id is not null and listing.owner_user_id <> auth.uid()) then
    raise exception 'This aircraft is no longer available';
  end if;
  if buyer.capital < listing.price then raise exception 'Insufficient capital'; end if;
  update public.companies set capital = capital - listing.price where id = buyer.id;
  insert into public.aircraft
    (user_id, company_id, name, icao_type, registration, health_pct, lease_cost_mo,
     total_hours, cycles, ownership, purchase_price, current_airport_icao)
  values
    (auth.uid(), buyer.id, listing.model_name, listing.icao_type, listing.registration,
     listing.health_pct, 0, listing.total_hours, listing.cycles, 'owned', listing.price, listing.location_icao)
  returning id into new_aircraft_id;
  insert into public.transactions (user_id, company_id, type, amount, description)
  values (auth.uid(), buyer.id, 'purchase', -listing.price,
          'Used aircraft purchase — ' || listing.model_name || ' (' || listing.registration || ')');
  update public.used_aircraft_listings set status = 'sold', sold_to_company_id = buyer.id, sold_at = now() where id = listing.id;
  return new_aircraft_id;
end; $$;

create or replace function public.lease_used_aircraft_listing(p_listing_id uuid, p_company_id uuid, p_term_months integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  buyer public.companies%rowtype; listing public.used_aircraft_listings%rowtype; aircraft_id uuid;
  down_payment numeric(14, 2); financed numeric(14, 2); apr numeric(6, 3);
  monthly_rate numeric; monthly_payment numeric(14, 2);
begin
  if p_term_months not in (12, 24, 36, 48) then raise exception 'Invalid lease duration'; end if;
  select * into buyer from public.companies where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  select * into listing from public.used_aircraft_listings where id = p_listing_id for update;
  if not found or listing.status <> 'available' or (listing.owner_user_id is not null and listing.owner_user_id <> auth.uid()) then
    raise exception 'This aircraft is no longer available';
  end if;
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
     listing.health_pct, monthly_payment, listing.total_hours, listing.cycles, 'leased', listing.price, listing.location_icao)
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
  update public.used_aircraft_listings set status = 'sold', sold_to_company_id = buyer.id, sold_at = now() where id = listing.id;
  return aircraft_id;
end; $$;

revoke all on function public.sync_custom_aircraft_profile(uuid, text, text, text, numeric, jsonb) from public;
revoke all on function public.remove_custom_aircraft_profile(uuid, text) from public;
grant execute on function public.sync_custom_aircraft_profile(uuid, text, text, text, numeric, jsonb) to authenticated;
grant execute on function public.remove_custom_aircraft_profile(uuid, text) to authenticated;
