-- Atomic sale and early lease-return operations.

create or replace function public.aircraft_disposal_quote(p_aircraft_id uuid, p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plane public.aircraft%rowtype;
  contract public.aircraft_leases%rowtype;
  gross_value numeric(14,2);
  commission numeric(14,2);
  net_value numeric(14,2);
  condition_fee numeric(14,2);
  termination_fee numeric(14,2);
begin
  if not exists (select 1 from public.companies where id = p_company_id and user_id = auth.uid()) then
    raise exception 'Company not found';
  end if;
  select * into plane from public.aircraft
    where id = p_aircraft_id and company_id = p_company_id and disposed_at is null;
  if not found then raise exception 'Active aircraft not found'; end if;

  select * into contract from public.aircraft_leases
    where aircraft_id = plane.id and status in ('active', 'overdue');

  if found then
    condition_fee := round(greatest(0, 70 - plane.health_pct) / 100 * contract.original_price * 0.05, 2);
    termination_fee := least(
      contract.remaining_amount,
      round(contract.monthly_payment * (2 + contract.missed_payments) + condition_fee, 2)
    );
    return jsonb_build_object(
      'kind', 'lease_return',
      'termination_fee', termination_fee,
      'condition_fee', condition_fee,
      'remaining_cancelled', contract.remaining_amount,
      'paid_amount_lost', contract.down_payment + greatest(0, contract.financed_amount - contract.remaining_amount)
    );
  end if;

  gross_value := round(greatest(
    plane.purchase_price * 0.20,
    plane.purchase_price
      * (0.45 + 0.55 * plane.health_pct / 100)
      * greatest(0.55, 1 - plane.total_hours / 50000 - plane.cycles::numeric / 100000)
  ), 2);
  commission := round(gross_value * 0.08, 2);
  net_value := gross_value - commission;
  return jsonb_build_object(
    'kind', 'sale',
    'gross_value', gross_value,
    'commission', commission,
    'net_value', net_value
  );
end;
$$;

create or replace function public.assert_aircraft_disposable(p_aircraft_id uuid, p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.aircraft
    where id = p_aircraft_id and company_id = p_company_id and user_id = auth.uid() and disposed_at is null
  ) then raise exception 'Active aircraft not found'; end if;

  if exists (
    select 1 from public.dispatches
    where aircraft_id = p_aircraft_id and status not in ('completed', 'cancelled')
  ) then raise exception 'Aircraft has an active dispatch. Complete or cancel it first'; end if;

  if exists (
    select 1 from public.schedules
    where aircraft_id = p_aircraft_id and status in ('planned', 'active')
  ) then raise exception 'Aircraft has an active schedule. Complete or cancel it first'; end if;
end;
$$;

create or replace function public.select_replacement_aircraft(p_company_id uuid, p_disposed_aircraft_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.aircraft
  where company_id = p_company_id and id <> p_disposed_aircraft_id and disposed_at is null
  order by health_pct desc, created_at
  limit 1
$$;

create or replace function public.sell_owned_aircraft(p_aircraft_id uuid, p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer public.companies%rowtype;
  plane public.aircraft%rowtype;
  quote jsonb;
  proceeds numeric(14,2);
  replacement_id uuid;
begin
  select * into buyer from public.companies
    where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  select * into plane from public.aircraft
    where id = p_aircraft_id and company_id = buyer.id and disposed_at is null for update;
  if not found then raise exception 'Active aircraft not found'; end if;
  if plane.ownership <> 'owned' then raise exception 'Leased aircraft must be returned, not sold'; end if;
  if exists (select 1 from public.aircraft_leases where aircraft_id = plane.id and status in ('active', 'overdue')) then
    raise exception 'Aircraft still has an active lease';
  end if;

  perform public.assert_aircraft_disposable(plane.id, buyer.id);
  quote := public.aircraft_disposal_quote(plane.id, buyer.id);
  proceeds := (quote->>'net_value')::numeric;

  update public.aircraft set disposed_at = now(), disposal_reason = 'sold' where id = plane.id;
  update public.crew_members set aircraft_id = null, status = 'available' where aircraft_id = plane.id;
  update public.companies set capital = capital + proceeds where id = buyer.id;
  insert into public.transactions(user_id, company_id, type, amount, description)
  values (auth.uid(), buyer.id, 'sale', proceeds,
    'Aircraft sale — ' || plane.name || coalesce(' (' || plane.registration || ')', ''));

  if buyer.active_aircraft_id = plane.id then
    replacement_id := public.select_replacement_aircraft(buyer.id, plane.id);
    update public.companies set active_aircraft_id = replacement_id where id = buyer.id;
  end if;
  return quote || jsonb_build_object('aircraft_id', plane.id);
end;
$$;

create or replace function public.terminate_aircraft_lease(p_lease_id uuid, p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer public.companies%rowtype;
  contract public.aircraft_leases%rowtype;
  plane public.aircraft%rowtype;
  quote jsonb;
  fee numeric(14,2);
  replacement_id uuid;
begin
  select * into buyer from public.companies
    where id = p_company_id and user_id = auth.uid() for update;
  if not found then raise exception 'Company not found'; end if;
  select * into contract from public.aircraft_leases
    where id = p_lease_id and company_id = buyer.id and status in ('active', 'overdue') for update;
  if not found then raise exception 'Active lease not found'; end if;
  select * into plane from public.aircraft
    where id = contract.aircraft_id and company_id = buyer.id and disposed_at is null for update;
  if not found then raise exception 'Active aircraft not found'; end if;

  perform public.assert_aircraft_disposable(plane.id, buyer.id);
  quote := public.aircraft_disposal_quote(plane.id, buyer.id);
  fee := (quote->>'termination_fee')::numeric;
  if buyer.capital < fee then raise exception 'Insufficient capital for the early return fee'; end if;

  update public.companies set capital = capital - fee where id = buyer.id;
  update public.aircraft_leases
    set status = 'terminated', completed_at = now()
    where id = contract.id;
  update public.aircraft set disposed_at = now(), disposal_reason = 'lease_returned' where id = plane.id;
  update public.crew_members set aircraft_id = null, status = 'available' where aircraft_id = plane.id;
  insert into public.transactions(user_id, company_id, type, amount, description)
  values (auth.uid(), buyer.id, 'lease_termination', -fee,
    'Early lease return — ' || plane.name || coalesce(' (' || plane.registration || ')', ''));

  if buyer.active_aircraft_id = plane.id then
    replacement_id := public.select_replacement_aircraft(buyer.id, plane.id);
    update public.companies set active_aircraft_id = replacement_id where id = buyer.id;
  end if;
  return quote || jsonb_build_object('aircraft_id', plane.id);
end;
$$;

revoke all on function public.aircraft_disposal_quote(uuid, uuid) from public;
revoke all on function public.assert_aircraft_disposable(uuid, uuid) from public;
revoke all on function public.select_replacement_aircraft(uuid, uuid) from public;
revoke all on function public.sell_owned_aircraft(uuid, uuid) from public;
revoke all on function public.terminate_aircraft_lease(uuid, uuid) from public;
grant execute on function public.aircraft_disposal_quote(uuid, uuid) to authenticated;
grant execute on function public.sell_owned_aircraft(uuid, uuid) to authenticated;
grant execute on function public.terminate_aircraft_lease(uuid, uuid) to authenticated;
