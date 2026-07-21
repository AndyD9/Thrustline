-- Remove PostgREST ambiguity between the public no-argument RPC and the private
-- timestamp implementation inherited from earlier migrations.

alter function public.advance_passive_schedules(timestamptz)
  rename to advance_passive_schedules_at;

revoke all on function public.advance_passive_schedules_at(timestamptz)
  from public, anon, authenticated;

create or replace function public.advance_passive_schedules()
returns table(started integer, completed integer)
language sql
security definer
set search_path = public
as $$
  select * from public.advance_passive_schedules_at(clock_timestamp())
$$;

revoke all on function public.advance_passive_schedules() from public;
grant execute on function public.advance_passive_schedules() to authenticated;
