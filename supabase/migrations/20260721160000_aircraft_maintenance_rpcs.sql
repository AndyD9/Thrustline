-- On-demand fleet maintenance with an atomic quote, capital debit, and health restore.

create or replace function public.aircraft_maintenance_quote(p_aircraft_id uuid, p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plane public.aircraft%rowtype;
  missing_health numeric(5,2);
  maintenance_cost numeric(14,2);
begin
  if not exists (select 1 from public.companies where id = p_company_id and user_id = auth.uid()) then
    raise exception 'Company not found';
  end if;

  select * into plane from public.aircraft
    where id = p_aircraft_id
      and company_id = p_company_id
      and user_id = auth.uid()
      and disposed_at is null;
  if not found then raise exception 'Active aircraft not found'; end if;

  missing_health := round(100 - plane.health_pct, 2);
  maintenance_cost := case
    when missing_health <= 0 then 0
    else round(greatest(1000, plane.purchase_price * (missing_health / 100) * 0.01), 2)
  end;

  return jsonb_build_object(
    'aircraft_id', plane.id,
    'current_health', plane.health_pct,
    'restored_health', 100,
    'health_restored', missing_health,
    'cost', maintenance_cost
  );
end;
$$;

create or replace function public.perform_aircraft_maintenance(p_aircraft_id uuid, p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator public.companies%rowtype;
  plane public.aircraft%rowtype;
  quote jsonb;
  maintenance_cost numeric(14,2);
begin
  select * into operator from public.companies
    where id = p_company_id and user_id = auth.uid()
    for update;
  if not found then raise exception 'Company not found'; end if;

  select * into plane from public.aircraft
    where id = p_aircraft_id
      and company_id = operator.id
      and user_id = auth.uid()
      and disposed_at is null
    for update;
  if not found then raise exception 'Active aircraft not found'; end if;
  if plane.health_pct >= 100 then raise exception 'Aircraft is already at full health'; end if;

  if exists (
    select 1 from public.dispatches
    where aircraft_id = plane.id and status not in ('pending', 'completed', 'cancelled')
  ) then raise exception 'Aircraft is currently assigned to an active dispatch'; end if;

  if exists (
    select 1 from public.schedule_legs leg
    join public.schedules schedule on schedule.id = leg.schedule_id
    where schedule.aircraft_id = plane.id and leg.status in ('dispatched', 'flying')
  ) then raise exception 'Aircraft is currently operating a scheduled flight'; end if;

  quote := public.aircraft_maintenance_quote(plane.id, operator.id);
  maintenance_cost := (quote->>'cost')::numeric;
  if operator.capital < maintenance_cost then raise exception 'Insufficient capital for maintenance'; end if;

  update public.companies set capital = capital - maintenance_cost where id = operator.id;
  update public.aircraft set health_pct = 100 where id = plane.id;
  insert into public.transactions (user_id, company_id, type, amount, description)
  values (
    auth.uid(), operator.id, 'maintenance', -maintenance_cost,
    'Full maintenance — ' || plane.name || coalesce(' (' || plane.registration || ')', '')
  );

  return quote;
end;
$$;

revoke all on function public.aircraft_maintenance_quote(uuid, uuid) from public;
revoke all on function public.perform_aircraft_maintenance(uuid, uuid) from public;
grant execute on function public.aircraft_maintenance_quote(uuid, uuid) to authenticated;
grant execute on function public.perform_aircraft_maintenance(uuid, uuid) to authenticated;
