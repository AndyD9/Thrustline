-- Curated SimBrief airframes supplied for the shared, secure aircraft market.

insert into public.new_aircraft_catalog
  (id, icao_type, manufacturer, model_name, price, owner_user_id, specs)
values
  ('simbrief-a21n-pw1130g', 'A21N', 'Airbus', 'A321-272NX (PW1130G-JM)', 129000000, null,
   '{"baseType":"A21N","engines":"PW1130G-JM","maxPaxEco":239,"maxPaxBiz":0,"rangeNm":4000,"cruiseSpeedKts":450,"ceilingFt":39100,"emptyWeightKg":50395,"maxZeroFuelKg":75600,"maxTakeoffKg":97000,"maxLandingKg":79200,"maxFuelKg":23770}'::jsonb),
  ('simbrief-a21n-leap1a33', 'A21N', 'Airbus', 'A321-253NX (LEAP-1A33)', 127000000, null,
   '{"baseType":"A21N","engines":"LEAP-1A33","maxPaxEco":235,"maxPaxBiz":0,"rangeNm":4000,"cruiseSpeedKts":450,"ceilingFt":39100,"emptyWeightKg":50288,"maxZeroFuelKg":73800,"maxTakeoffKg":93500,"maxLandingKg":77800,"maxFuelKg":21374}'::jsonb),
  ('simbrief-a320-cfm56', 'A320', 'Airbus', 'Fenix A320 (CFM56-5B4/P)', 101000000, null,
   '{"baseType":"A320","engines":"CFM56-5B4/P","maxPaxEco":180,"maxPaxBiz":0,"rangeNm":3300,"cruiseSpeedKts":447,"ceilingFt":39800,"emptyWeightKg":44029,"maxZeroFuelKg":61000,"maxTakeoffKg":73500,"maxLandingKg":64500,"maxFuelKg":19004,"maxCargoKg":9440}'::jsonb),
  ('simbrief-a320-iae', 'A320', 'Airbus', 'Fenix A320 (IAE V2527-A5)', 101000000, null,
   '{"baseType":"A320","engines":"IAE V2527-A5","maxPaxEco":180,"maxPaxBiz":0,"rangeNm":3300,"cruiseSpeedKts":447,"ceilingFt":39800,"emptyWeightKg":44029,"maxZeroFuelKg":61000,"maxTakeoffKg":73500,"maxLandingKg":64500,"maxFuelKg":19004,"maxCargoKg":9440}'::jsonb),
  ('simbrief-a346-trent556', 'A346', 'Airbus', 'A340-642 (Trent 556B-61)', 275000000, null,
   '{"baseType":"A346","engines":"TRENT 556B-61","maxPaxEco":440,"maxPaxBiz":0,"rangeNm":7900,"cruiseSpeedKts":470,"ceilingFt":41500,"emptyWeightKg":185500,"maxZeroFuelKg":245000,"maxTakeoffKg":368000,"maxLandingKg":259000,"maxFuelKg":152024,"maxCargoKg":56811}'::jsonb)
on conflict (id) do update set
  model_name = excluded.model_name,
  manufacturer = excluded.manufacturer,
  price = excluded.price,
  specs = excluded.specs;

insert into public.used_aircraft_listings
  (id, icao_type, model_name, registration, seller_name, manufacture_year, total_hours,
   cycles, health_pct, price, location_icao, owner_user_id)
values
  ('20000000-0000-4000-8000-000000000001', 'A21N', 'A321-272NX (PW1130G-JM)', 'D-AIPW', 'Nordic Aviation Capital', 2020, 7200, 4180, 91, 101000000, 'EDDF', null),
  ('20000000-0000-4000-8000-000000000002', 'A21N', 'A321-272NX (PW1130G-JM)', 'EI-NPW', 'Emerald Fleet Partners', 2018, 14600, 8350, 79, 82500000, 'EIDW', null),
  ('20000000-0000-4000-8000-000000000003', 'A21N', 'A321-253NX (LEAP-1A33)', 'F-HNXL', 'European Aircraft Exchange', 2021, 5900, 3470, 94, 104000000, 'LFPO', null),
  ('20000000-0000-4000-8000-000000000004', 'A21N', 'A321-253NX (LEAP-1A33)', 'EC-NXL', 'Iberian Fleet Partners', 2019, 12100, 7020, 83, 87500000, 'LEMD', null),
  ('20000000-0000-4000-8000-000000000005', 'A320', 'Fenix A320 (CFM56-5B4/P)', 'G-FNCF', 'Albion Aircraft Trading', 2013, 28100, 18120, 76, 28600000, 'EGKK', null),
  ('20000000-0000-4000-8000-000000000006', 'A320', 'Fenix A320 (CFM56-5B4/P)', 'F-GKCF', 'Hexagone Aviation Assets', 2008, 42300, 26400, 64, 19700000, 'LFPG', null),
  ('20000000-0000-4000-8000-000000000007', 'A320', 'Fenix A320 (IAE V2527-A5)', 'N320IA', 'Atlantic Aircraft Sales', 2014, 24600, 15300, 81, 32100000, 'KJFK', null),
  ('20000000-0000-4000-8000-000000000008', 'A320', 'Fenix A320 (IAE V2527-A5)', 'D-AIIA', 'Central Europe Air', 2009, 39800, 24850, 67, 21400000, 'EDDM', null),
  ('20000000-0000-4000-8000-000000000009', 'A346', 'A340-642 (Trent 556B-61)', 'D-AIHT', 'Global Widebody Partners', 2008, 58200, 8120, 66, 42800000, 'EDDF', null),
  ('20000000-0000-4000-8000-000000000010', 'A346', 'A340-642 (Trent 556B-61)', 'HB-JMK', 'Alpine Aviation Capital', 2005, 69400, 9730, 55, 31500000, 'LSZH', null)
on conflict (id) do update set
  model_name = excluded.model_name,
  seller_name = excluded.seller_name,
  price = excluded.price;
