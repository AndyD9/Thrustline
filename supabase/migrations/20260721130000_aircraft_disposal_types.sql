-- Fleet disposal lifecycle. Aircraft rows are retained to preserve flight and schedule history.

alter type public.aircraft_lease_status add value if not exists 'terminated';
alter type public.transaction_type add value if not exists 'lease_termination' after 'lease';

alter table public.aircraft
  add column if not exists disposed_at timestamptz,
  add column if not exists disposal_reason text
    check (disposal_reason is null or disposal_reason in ('sold', 'lease_returned'));

create index if not exists aircraft_company_available_idx
  on public.aircraft(company_id, created_at desc)
  where disposed_at is null;
