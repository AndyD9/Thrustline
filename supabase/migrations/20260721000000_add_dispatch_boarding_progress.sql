alter table public.dispatches
  add column boarded_pax_eco integer not null default 0 check (boarded_pax_eco >= 0),
  add column boarded_pax_biz integer not null default 0 check (boarded_pax_biz >= 0),
  add column boarding_started_at timestamptz,
  add column boarding_completed_at timestamptz;

alter table public.dispatches
  add constraint dispatch_boarded_eco_within_planned check (boarded_pax_eco <= pax_eco),
  add constraint dispatch_boarded_biz_within_planned check (boarded_pax_biz <= pax_biz);
