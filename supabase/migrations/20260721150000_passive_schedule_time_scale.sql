-- Accelerated wall-clock execution for passive schedules.
alter table public.schedules
  add column if not exists time_scale integer not null default 12
    check (time_scale in (1, 6, 12, 24));

-- Player-operated schedules always remain real-time.
update public.schedules set time_scale = 1 where passive_enabled = false;

-- Rebase remaining legs of existing passive schedules from migration time so
-- already-created operations also benefit immediately from acceleration.
with remaining as (
  select
    l.id,
    l.estimated_minutes,
    s.time_scale,
    coalesce(
      sum(l.estimated_minutes + s.ground_time_minutes) over (
        partition by l.schedule_id order by l.sequence
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as preceding_operational_minutes
  from public.schedule_legs l
  join public.schedules s on s.id = l.schedule_id
  where s.status = 'active' and s.passive_enabled
    and l.operation_mode = 'passive'
    and l.status in ('planned', 'available', 'flying')
), rebased as (
  select
    id,
    now() + preceding_operational_minutes / time_scale * interval '1 minute' as departure_at,
    now() + (preceding_operational_minutes + estimated_minutes) / time_scale * interval '1 minute' as arrival_at
  from remaining
)
update public.schedule_legs l
set scheduled_departure_at = r.departure_at,
    scheduled_arrival_at = r.arrival_at,
    actual_departure_at = case when l.status = 'flying' then r.departure_at else l.actual_departure_at end
from rebased r
where l.id = r.id;
