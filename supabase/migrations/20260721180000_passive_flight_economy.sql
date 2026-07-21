-- Passenger-driven economics for passive operations. Kept server-side so the
-- offline catch-up path uses exactly the same rules as an online completion.

alter table public.flights
  add column if not exists pax_eco integer not null default 0 check (pax_eco >= 0),
  add column if not exists pax_biz integer not null default 0 check (pax_biz >= 0),
  add column if not exists load_factor_pct numeric(5,2) check (load_factor_pct between 0 and 100),
  add column if not exists maintenance_cost numeric(14,2) not null default 0 check (maintenance_cost >= 0),
  add column if not exists operation_mode text not null default 'player' check (operation_mode in ('player', 'passive'));

alter table public.crew_members
  add column if not exists duty_available_at timestamptz;

create or replace function public.advance_passive_schedules(p_now timestamptz default now())
returns table(started integer, completed integer)
language plpgsql security invoker set search_path = public as $$
declare
  leg record; flight_id uuid; eco_cap integer; biz_cap integer; pax_y integer; pax_j integer; market_seats integer;
  lf numeric; biz_lf numeric; rep numeric; fare_y numeric; fare_j numeric; route_fare numeric; demand numeric;
  dist_factor numeric; hour_factor numeric; event_factor numeric; rand_factor numeric; price_factor numeric;
  burn_hour numeric; taxi_fuel numeric; fuel_used numeric; landing_base numeric; maint_hour numeric; cycle_cost numeric;
  revenue_amount numeric(14,2); fuel_amount numeric(14,2); landing_amount numeric(14,2); maintenance_amount numeric(14,2); net_amount numeric(14,2);
  started_count integer := 0; completed_count integer := 0;
begin
  -- Crew who reached their duty limit become available again after a
  -- mandatory rest period, including while the app was closed.
  update public.crew_members
  set status = 'available', duty_available_at = null
  where user_id = auth.uid() and status = 'resting'
    and duty_available_at is not null and duty_available_at <= p_now;

  for leg in
    select l.*, s.user_id, s.company_id, s.aircraft_id, s.captain_id, s.first_officer_id, upper(a.icao_type) icao
    from public.schedule_legs l join public.schedules s on s.id = l.schedule_id join public.aircraft a on a.id = s.aircraft_id
    where s.user_id = auth.uid() and s.status = 'active' and l.operation_mode = 'passive' and l.status = 'flying' and l.scheduled_arrival_at <= p_now
    order by l.scheduled_arrival_at, l.sequence for update of l
  loop
    eco_cap := case leg.icao
      when 'A319' then 140 when 'A320' then 180 when 'A20N' then 180 when 'A321' then 220
      when 'A332' then 253 when 'A333' then 295 when 'A339' then 287 when 'A342' then 261 when 'A346' then 380 when 'A359' then 315 when 'A35K' then 366 when 'A388' then 555
      when 'B737' then 137 when 'B738' then 184 when 'B739' then 204 when 'B38M' then 189 when 'B752' then 200 when 'B763' then 269 when 'B77W' then 396 when 'B77L' then 301 when 'B748' then 410 when 'B78X' then 330 when 'B789' then 296 when 'B788' then 242
      when 'CRJ7' then 70 when 'CRJ9' then 86 when 'E170' then 72 when 'E190' then 100 when 'E295' then 132 when 'AT76' then 72 when 'DH8D' then 78
      when 'C172' then 3 when 'C208' then 9 when 'TBM9' then 5 when 'PC12' then 9 when 'BE58' then 5 else 90 end;
    biz_cap := case leg.icao
      when 'A319' then 12 when 'A320' then 16 when 'A20N' then 16 when 'A321' then 20 when 'A332' then 36 when 'A333' then 36 when 'A339' then 36 when 'A342' then 30 when 'A346' then 42 when 'A359' then 40 when 'A35K' then 44 when 'A388' then 60
      when 'B737' then 12 when 'B738' then 16 when 'B739' then 16 when 'B38M' then 16 when 'B752' then 24 when 'B763' then 30 when 'B77W' then 42 when 'B77L' then 36 when 'B748' then 48 when 'B78X' then 36 when 'B789' then 28 when 'B788' then 22
      when 'CRJ7' then 6 when 'CRJ9' then 6 when 'E170' then 6 when 'E190' then 10 when 'E295' then 12 else 0 end;

    -- Representative cruise burn (US gal/hour) and fixed turn costs by aircraft class.
    if leg.icao in ('C172','C208','TBM9','PC12','BE58') then burn_hour := case leg.icao when 'C172' then 9 when 'BE58' then 28 when 'C208' then 48 else 60 end; taxi_fuel := 5; landing_base := 90; maint_hour := 70; cycle_cost := 40;
    elsif leg.icao in ('AT76','DH8D') then burn_hour := case leg.icao when 'AT76' then 190 else 230 end; taxi_fuel := 28; landing_base := 375; maint_hour := 240; cycle_cost := 185;
    elsif leg.icao ~ '^(CRJ|E1|E2)' then burn_hour := 470; taxi_fuel := 58; landing_base := 600; maint_hour := 350; cycle_cost := 250;
    elsif leg.icao in ('A319','A320','A20N','A321','B737','B738','B739','B38M') then burn_hour := case when leg.icao in ('A20N','B38M') then 620 else 750 end; taxi_fuel := 95; landing_base := 1000; maint_hour := 530; cycle_cost := 375;
    elsif leg.icao in ('A342','A346','A388','B748','B77W','B77L') then burn_hour := case leg.icao when 'A342' then 2450 when 'A346' then 3000 when 'A388' then 3100 when 'B748' then 2900 else 2350 end; taxi_fuel := 310; landing_base := 4000; maint_hour := 2100; cycle_cost := 1450;
    else burn_hour := case when leg.icao ~ '^(A35|B78)' then 1650 else 1850 end; taxi_fuel := 210; landing_base := 2700; maint_hour := 1250; cycle_cost := 900;
    end if;

    select coalesce(max(r.score),50), max(rt.base_price) into rep, route_fare
    from (select 1) seed left join public.reputations r on r.company_id=leg.company_id and upper(r.origin_icao)=upper(leg.origin_icao) and upper(r.dest_icao)=upper(leg.dest_icao)
    left join public.routes rt on rt.company_id=leg.company_id and upper(rt.origin_icao)=upper(leg.origin_icao) and upper(rt.dest_icao)=upper(leg.dest_icao);
    fare_y := round(coalesce(nullif(route_fare,0),35 + leg.distance_nm*.16),2); fare_j := round(fare_y*3,2);
    price_factor := greatest(.70,least(1.30,(35+leg.distance_nm*.16)/greatest(fare_y,1)));
    dist_factor := case when leg.distance_nm<500 then 1.10 when leg.distance_nm<1500 then 1 when leg.distance_nm<3000 then .95 else .90 end;
    hour_factor := case when extract(hour from leg.scheduled_departure_at) between 6 and 9 or extract(hour from leg.scheduled_departure_at) between 17 and 20 then 1.10 when extract(hour from leg.scheduled_departure_at) between 10 and 16 then 1 when extract(hour from leg.scheduled_departure_at) between 21 and 23 then .85 else .70 end;
    select coalesce(exp(sum(ln(greatest(.1,e.modifier)))),1) into event_factor from public.game_events e where e.company_id=leg.company_id and e.starts_at<=leg.scheduled_departure_at and e.expires_at>=leg.scheduled_departure_at and e.type in ('tourism_boom','strike');
    rand_factor := .90+(abs(hashtext(leg.id::text))%21)/100.0;
    demand := greatest(.20,least(.98,.72*dist_factor*hour_factor*(.5+rep/100)*event_factor*rand_factor*price_factor));
    market_seats := greatest(8,round((45+sqrt(greatest(leg.distance_nm,1))*5)*demand));
    pax_y := least(eco_cap,greatest(0,round(least(eco_cap*demand,market_seats*.92))));
    biz_lf := greatest(.10,least(.90,demand*.60)); pax_j := least(biz_cap,greatest(0,round(least(biz_cap*biz_lf,market_seats*.08))));
    lf := case when eco_cap+biz_cap>0 then (pax_y+pax_j)::numeric/(eco_cap+biz_cap) else 0 end;
    revenue_amount := round(pax_y*fare_y+pax_j*fare_j,2);
    fuel_used := round(burn_hour*greatest(leg.estimated_minutes,1)/60.0*(.92+lf*.08)*(case when leg.distance_nm<800 then 1.12 else 1 end)+taxi_fuel,2);
    fuel_amount := round(fuel_used*5.50,2); landing_amount := round(landing_base+(pax_y+pax_j)*8,2);
    maintenance_amount := round(maint_hour*greatest(leg.estimated_minutes,1)/60.0+cycle_cost,2);
    net_amount := revenue_amount-fuel_amount-landing_amount-maintenance_amount;

    insert into public.flights(user_id,company_id,aircraft_id,departure_icao,arrival_icao,duration_min,fuel_used_gal,distance_nm,landing_vs_fpm,revenue,fuel_cost,landing_fee,maintenance_cost,net_result,landing_grade,pax_satisfaction,pax_eco,pax_biz,load_factor_pct,operation_mode,started_at,completed_at)
    values(leg.user_id,leg.company_id,leg.aircraft_id,leg.origin_icao,leg.dest_icao,leg.estimated_minutes,fuel_used,leg.distance_nm,-220,revenue_amount,fuel_amount,landing_amount,maintenance_amount,net_amount,'B',82,pax_y,pax_j,round(lf*100,2),'passive',coalesce(leg.actual_departure_at,leg.scheduled_departure_at),leg.scheduled_arrival_at) returning id into flight_id;
    insert into public.transactions(user_id,company_id,flight_id,type,amount,description) values
      (leg.user_id,leg.company_id,flight_id,'revenue',revenue_amount,'Passive ticket sales '||leg.flight_number||' ('||pax_y||'Y + '||pax_j||'J)'),
      (leg.user_id,leg.company_id,flight_id,'fuel',-fuel_amount,'Passive fuel '||leg.flight_number||' ('||fuel_used||' gal)'),
      (leg.user_id,leg.company_id,flight_id,'landing_fee',-landing_amount,'Landing and passenger fees '||leg.dest_icao),
      (leg.user_id,leg.company_id,flight_id,'maintenance',-maintenance_amount,'Variable maintenance '||leg.flight_number);
    update public.companies set capital=capital+net_amount where id=leg.company_id;
    update public.aircraft set current_airport_icao=leg.dest_icao,cycles=cycles+1,total_hours=total_hours+leg.estimated_minutes/60.0,health_pct=greatest(0,health_pct-greatest(.15,leg.estimated_minutes/600.0)) where id=leg.aircraft_id;
    update public.crew_members
    set duty_hours = case
          when duty_hours + leg.estimated_minutes / 60.0 >= max_duty_h then 0
          else duty_hours + leg.estimated_minutes / 60.0
        end,
        status = case
          when duty_hours + leg.estimated_minutes / 60.0 >= max_duty_h then 'resting'::public.crew_status
          else 'available'::public.crew_status
        end,
        duty_available_at = case
          when duty_hours + leg.estimated_minutes / 60.0 >= max_duty_h then p_now + interval '10 hours'
          else null
        end
    where id in(leg.captain_id,leg.first_officer_id)
      or id in(select crew_member_id from public.schedule_cabin_crew where schedule_id=leg.schedule_id);
    update public.schedule_legs set status='completed',completed_at=p_now,actual_arrival_at=leg.scheduled_arrival_at where id=leg.id;
    update public.schedule_rotations r set status='completed' where r.id=leg.rotation_id and not exists(select 1 from public.schedule_legs p where p.rotation_id=r.id and p.status<>'completed');
    update public.schedule_legs n set status='available' where n.id=(select c.id from public.schedule_legs c where c.schedule_id=leg.schedule_id and c.sequence>leg.sequence and c.status='planned' order by c.sequence limit 1);
    if not exists(select 1 from public.schedule_legs p where p.schedule_id=leg.schedule_id and p.status<>'completed') then update public.schedules set status='completed',completed_at=p_now where id=leg.schedule_id; end if;
    completed_count:=completed_count+1;
  end loop;

  for leg in select l.*,s.aircraft_id,s.captain_id,s.first_officer_id from public.schedule_legs l join public.schedules s on s.id=l.schedule_id join public.aircraft a on a.id=s.aircraft_id join public.crew_members captain on captain.id=s.captain_id join public.crew_members first_officer on first_officer.id=s.first_officer_id
    where s.user_id=auth.uid() and s.status='active' and s.passive_enabled and l.operation_mode='passive' and l.status='available' and l.scheduled_departure_at<=p_now and captain.status='available' and captain.duty_hours<captain.max_duty_h and first_officer.status='available' and first_officer.duty_hours<first_officer.max_duty_h
      and (select count(*) from public.schedule_cabin_crew where schedule_id=s.id)=s.cabin_crew_required and not exists(select 1 from public.schedule_cabin_crew cc join public.crew_members c on c.id=cc.crew_member_id where cc.schedule_id=s.id and(c.status<>'available' or c.duty_hours>=c.max_duty_h)) and upper(coalesce(a.current_airport_icao,s.start_airport_icao))=upper(l.origin_icao)
      and not exists(select 1 from public.schedule_legs b join public.schedules bs on bs.id=b.schedule_id where b.status='flying' and(bs.aircraft_id=s.aircraft_id or bs.captain_id in(s.captain_id,s.first_officer_id) or bs.first_officer_id in(s.captain_id,s.first_officer_id))) order by l.scheduled_departure_at,l.sequence for update of l
  loop
    update public.schedule_legs set status='flying',actual_departure_at=leg.scheduled_departure_at where id=leg.id;
    update public.crew_members set status='flying' where id in(leg.captain_id,leg.first_officer_id) or id in(select crew_member_id from public.schedule_cabin_crew where schedule_id=leg.schedule_id);
    started_count:=started_count+1;
  end loop;
  return query select started_count,completed_count;
end; $$;

comment on column public.flights.maintenance_cost is 'Variable per-flight maintenance; fixed monthly costs are excluded.';
