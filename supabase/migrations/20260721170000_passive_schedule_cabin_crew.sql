-- Assign the aircraft-specific number of cabin crew to passive schedules.

alter table public.schedules
  add column if not exists cabin_crew_required integer not null default 0
  check (cabin_crew_required between 0 and 30);

create table if not exists public.schedule_cabin_crew (
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  crew_member_id uuid not null references public.crew_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (schedule_id, crew_member_id)
);

create index if not exists schedule_cabin_crew_member_idx
  on public.schedule_cabin_crew(crew_member_id);

alter table public.schedule_cabin_crew enable row level security;
create policy "users manage own schedule cabin crew" on public.schedule_cabin_crew
  for all using (
    exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid())
  );

create or replace function public.validate_schedule_cabin_crew()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  target_schedule public.schedules%rowtype;
  member public.crew_members%rowtype;
begin
  select * into target_schedule from public.schedules where id = new.schedule_id;
  select * into member from public.crew_members where id = new.crew_member_id;
  if member.rank <> 'cabin_crew' then raise exception 'Selected cabin crew must have the cabin crew rank'; end if;
  if member.company_id <> target_schedule.company_id then raise exception 'Schedule crew must belong to the same company'; end if;
  if new.crew_member_id in (target_schedule.captain_id, target_schedule.first_officer_id) then raise exception 'A crew member cannot fill two positions'; end if;
  if (select count(*) from public.schedule_cabin_crew where schedule_id = new.schedule_id) >= target_schedule.cabin_crew_required then
    raise exception 'This schedule already has its required cabin crew';
  end if;
  if target_schedule.status in ('planned', 'active') and exists (
    select 1 from public.schedules s
    left join public.schedule_cabin_crew cc on cc.schedule_id = s.id
    where s.id <> target_schedule.id and s.status in ('planned', 'active') and s.passive_enabled
      and new.crew_member_id in (s.captain_id, s.first_officer_id, cc.crew_member_id)
  ) then raise exception 'A selected crew member is already assigned to another active schedule'; end if;
  return new;
end;
$$;

create trigger schedule_cabin_crew_validate
  before insert or update on public.schedule_cabin_crew
  for each row execute function public.validate_schedule_cabin_crew();

-- Include cabin assignments when checking pilot conflicts.
create or replace function public.validate_schedule_crew()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  captain_rank public.crew_rank; first_officer_rank public.crew_rank;
  captain_company uuid; first_officer_company uuid;
begin
  if not new.passive_enabled then return new; end if;
  if new.captain_id is null or new.first_officer_id is null then raise exception 'Passive schedules require a captain and a first officer'; end if;
  if new.captain_id = new.first_officer_id then raise exception 'Captain and first officer must be different crew members'; end if;
  select rank, company_id into captain_rank, captain_company from public.crew_members where id = new.captain_id;
  select rank, company_id into first_officer_rank, first_officer_company from public.crew_members where id = new.first_officer_id;
  if captain_rank <> 'captain' or first_officer_rank <> 'first_officer' then raise exception 'The selected crew members do not have the required ranks'; end if;
  if captain_company <> new.company_id or first_officer_company <> new.company_id then raise exception 'Schedule crew must belong to the same company'; end if;
  if new.status in ('planned', 'active') and exists (
    select 1 from public.schedules s
    left join public.schedule_cabin_crew cc on cc.schedule_id = s.id
    where s.id <> new.id and s.status in ('planned', 'active') and s.passive_enabled
      and (s.captain_id in (new.captain_id, new.first_officer_id)
        or s.first_officer_id in (new.captain_id, new.first_officer_id)
        or cc.crew_member_id in (new.captain_id, new.first_officer_id))
  ) then raise exception 'A selected crew member is already assigned to another active schedule'; end if;
  return new;
end;
$$;

create or replace function public.advance_passive_schedules(p_now timestamptz default now())
returns table(started integer, completed integer)
language plpgsql security invoker set search_path = public as $$
declare
  leg record; flight_id uuid; revenue_amount numeric(14,2); fuel_amount numeric(14,2);
  landing_amount numeric(14,2); net_amount numeric(14,2); started_count integer := 0; completed_count integer := 0;
begin
  for leg in
    select l.*, s.user_id, s.company_id, s.aircraft_id, s.captain_id, s.first_officer_id
    from public.schedule_legs l join public.schedules s on s.id = l.schedule_id
    where s.user_id = auth.uid() and s.status = 'active' and l.operation_mode = 'passive'
      and l.status = 'flying' and l.scheduled_arrival_at <= p_now
    order by l.scheduled_arrival_at, l.sequence for update of l
  loop
    revenue_amount := round(leg.distance_nm * 12.00, 2); fuel_amount := round(leg.distance_nm * 2.20, 2);
    landing_amount := 250.00; net_amount := revenue_amount - fuel_amount - landing_amount;
    insert into public.flights (user_id, company_id, aircraft_id, departure_icao, arrival_icao, duration_min, fuel_used_gal, distance_nm, landing_vs_fpm, revenue, fuel_cost, landing_fee, net_result, landing_grade, pax_satisfaction, started_at, completed_at)
    values (leg.user_id, leg.company_id, leg.aircraft_id, leg.origin_icao, leg.dest_icao, leg.estimated_minutes, round(leg.distance_nm * 0.18, 2), leg.distance_nm, -220, revenue_amount, fuel_amount, landing_amount, net_amount, 'B', 82, coalesce(leg.actual_departure_at, leg.scheduled_departure_at), leg.scheduled_arrival_at) returning id into flight_id;
    insert into public.transactions(user_id, company_id, flight_id, type, amount, description) values
      (leg.user_id, leg.company_id, flight_id, 'revenue', revenue_amount, 'Passive ticket sales ' || leg.flight_number),
      (leg.user_id, leg.company_id, flight_id, 'fuel', -fuel_amount, 'Passive flight fuel ' || leg.flight_number),
      (leg.user_id, leg.company_id, flight_id, 'landing_fee', -landing_amount, 'Landing fee ' || leg.dest_icao);
    update public.companies set capital = capital + net_amount where id = leg.company_id;
    update public.aircraft set current_airport_icao = leg.dest_icao, cycles = cycles + 1, total_hours = total_hours + leg.estimated_minutes / 60.0, health_pct = greatest(0, health_pct - greatest(0.15, leg.estimated_minutes / 600.0)) where id = leg.aircraft_id;
    update public.crew_members set duty_hours = least(max_duty_h, duty_hours + leg.estimated_minutes / 60.0), status = 'available'
      where id in (leg.captain_id, leg.first_officer_id) or id in (select crew_member_id from public.schedule_cabin_crew where schedule_id = leg.schedule_id);
    update public.schedule_legs set status = 'completed', completed_at = p_now, actual_arrival_at = leg.scheduled_arrival_at where id = leg.id;
    update public.schedule_rotations r set status = 'completed' where r.id = leg.rotation_id and not exists (select 1 from public.schedule_legs pending where pending.rotation_id = r.id and pending.status <> 'completed');
    update public.schedule_legs next_leg set status = 'available' where next_leg.id = (select candidate.id from public.schedule_legs candidate where candidate.schedule_id = leg.schedule_id and candidate.sequence > leg.sequence and candidate.status = 'planned' order by candidate.sequence limit 1);
    if not exists (select 1 from public.schedule_legs pending where pending.schedule_id = leg.schedule_id and pending.status <> 'completed') then update public.schedules set status = 'completed', completed_at = p_now where id = leg.schedule_id; end if;
    completed_count := completed_count + 1;
  end loop;

  for leg in
    select l.*, s.aircraft_id, s.captain_id, s.first_officer_id
    from public.schedule_legs l join public.schedules s on s.id = l.schedule_id join public.aircraft a on a.id = s.aircraft_id
    join public.crew_members captain on captain.id = s.captain_id join public.crew_members first_officer on first_officer.id = s.first_officer_id
    where s.user_id = auth.uid() and s.status = 'active' and s.passive_enabled and l.operation_mode = 'passive' and l.status = 'available'
      and l.scheduled_departure_at <= p_now and captain.status = 'available' and captain.duty_hours < captain.max_duty_h
      and first_officer.status = 'available' and first_officer.duty_hours < first_officer.max_duty_h
      and (select count(*) from public.schedule_cabin_crew where schedule_id = s.id) = s.cabin_crew_required
      and not exists (select 1 from public.schedule_cabin_crew cc join public.crew_members c on c.id = cc.crew_member_id where cc.schedule_id = s.id and (c.status <> 'available' or c.duty_hours >= c.max_duty_h))
      and upper(coalesce(a.current_airport_icao, s.start_airport_icao)) = upper(l.origin_icao)
      and not exists (select 1 from public.schedule_legs busy join public.schedules busy_s on busy_s.id = busy.schedule_id where busy.status = 'flying' and (busy_s.aircraft_id = s.aircraft_id or busy_s.captain_id in (s.captain_id, s.first_officer_id) or busy_s.first_officer_id in (s.captain_id, s.first_officer_id)))
    order by l.scheduled_departure_at, l.sequence for update of l
  loop
    update public.schedule_legs set status = 'flying', actual_departure_at = leg.scheduled_departure_at where id = leg.id;
    update public.crew_members set status = 'flying' where id in (leg.captain_id, leg.first_officer_id) or id in (select crew_member_id from public.schedule_cabin_crew where schedule_id = leg.schedule_id);
    started_count := started_count + 1;
  end loop;
  return query select started_count, completed_count;
end;
$$;

grant select, insert, update, delete on public.schedule_cabin_crew to authenticated;
