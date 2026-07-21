-- SECURITY DEFINER functions must explicitly require a Supabase user session.
create or replace function public.advance_passive_schedules()
returns table(started integer, completed integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query select * from public.advance_passive_schedules_at(clock_timestamp());
end;
$$;

revoke all on function public.advance_passive_schedules() from public, anon;
grant execute on function public.advance_passive_schedules() to authenticated;
