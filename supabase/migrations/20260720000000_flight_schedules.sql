-- Flight schedules: continuous aircraft rotations without teleporting.

alter table public.aircraft
  add column if not exists current_airport_icao text;

update public.aircraft a
set current_airport_icao = c.hub_icao
from public.companies c
where a.company_id = c.id
  and a.current_airport_icao is null;

create table public.schedules (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  company_id           uuid not null references public.companies(id) on delete cascade,
  aircraft_id          uuid not null references public.aircraft(id) on delete cascade,
  name                 text not null,
  status               text not null default 'planned'
                         check (status in ('planned', 'active', 'completed', 'cancelled')),
  start_airport_icao   text not null,
  hub_icao             text not null,
  max_flight_minutes   integer not null check (max_flight_minutes > 0),
  target_flights       integer not null check (target_flights > 0),
  target_rotations     integer not null check (target_rotations > 0),
  return_to_hub        boolean not null default true,
  generation_settings  jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz
);

create table public.schedule_rotations (
  id                   uuid primary key default gen_random_uuid(),
  schedule_id          uuid not null references public.schedules(id) on delete cascade,
  sequence             integer not null check (sequence > 0),
  start_airport_icao   text not null,
  end_airport_icao     text not null,
  estimated_minutes    integer not null default 0 check (estimated_minutes >= 0),
  status               text not null default 'planned'
                         check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_at           timestamptz not null default now(),
  unique (schedule_id, sequence)
);

create table public.schedule_legs (
  id                   uuid primary key default gen_random_uuid(),
  schedule_id          uuid not null references public.schedules(id) on delete cascade,
  rotation_id          uuid not null references public.schedule_rotations(id) on delete cascade,
  dispatch_id          uuid references public.dispatches(id) on delete set null,
  sequence             integer not null check (sequence > 0),
  origin_icao          text not null,
  dest_icao            text not null,
  distance_nm          numeric(10, 2) not null check (distance_nm > 0),
  estimated_minutes    integer not null check (estimated_minutes > 0),
  flight_number        text not null,
  status               text not null default 'planned'
                         check (status in ('planned', 'available', 'dispatched', 'flying', 'completed', 'cancelled')),
  created_at           timestamptz not null default now(),
  completed_at         timestamptz,
  unique (schedule_id, sequence),
  unique (dispatch_id)
);

create index schedules_company_status_idx
  on public.schedules(company_id, status);
create index schedules_aircraft_status_idx
  on public.schedules(aircraft_id, status);
create unique index schedules_one_active_per_aircraft_idx
  on public.schedules(aircraft_id)
  where status in ('planned', 'active');
create index schedule_rotations_schedule_idx
  on public.schedule_rotations(schedule_id, sequence);
create index schedule_legs_schedule_status_idx
  on public.schedule_legs(schedule_id, status, sequence);
create index schedule_legs_dispatch_idx
  on public.schedule_legs(dispatch_id) where dispatch_id is not null;

create unique index dispatches_one_flying_per_aircraft_idx
  on public.dispatches(aircraft_id)
  where aircraft_id is not null and status = 'flying';

create or replace function public.validate_dispatch_aircraft_position()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  aircraft_position text;
begin
  if new.status <> 'flying' or new.aircraft_id is null then
    return new;
  end if;

  select coalesce(a.current_airport_icao, c.hub_icao)
    into aircraft_position
  from public.aircraft a
  join public.companies c on c.id = a.company_id
  where a.id = new.aircraft_id;

  if aircraft_position is null then
    raise exception 'Aircraft position is unknown';
  end if;

  if upper(new.origin_icao) <> upper(aircraft_position) then
    raise exception 'Aircraft is at %, not %', aircraft_position, new.origin_icao;
  end if;

  return new;
end;
$$;

create trigger dispatch_validate_aircraft_position
  before insert or update of status, origin_icao, aircraft_id on public.dispatches
  for each row execute function public.validate_dispatch_aircraft_position();

create trigger schedules_set_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

alter table public.schedules enable row level security;
alter table public.schedule_rotations enable row level security;
alter table public.schedule_legs enable row level security;

create policy "users manage own schedules" on public.schedules
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own schedule rotations" on public.schedule_rotations
  for all using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id and s.user_id = auth.uid()
    )
  );

create policy "users manage own schedule legs" on public.schedule_legs
  for all using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id and s.user_id = auth.uid()
    )
  );
