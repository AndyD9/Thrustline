// Aircraft type database — common MSFS 2024 aircraft with realistic specs

export interface AircraftType {
  icaoType: string;
  name: string;
  manufacturer: string;
  rangeNm: number;
  maxPaxEco: number;
  maxPaxBiz: number;
  fuelCapacityGal: number;
  ceilingFt: number;
  cruiseSpeedKts: number;
}

export const aircraftTypes: AircraftType[] = [
  // ——— Airbus narrow-body ———
  { icaoType: "A319", name: "A319",          manufacturer: "Airbus",   rangeNm: 3750, maxPaxEco: 140, maxPaxBiz: 12, fuelCapacityGal: 6300,  ceilingFt: 39000, cruiseSpeedKts: 447 },
  { icaoType: "A320", name: "A320",          manufacturer: "Airbus",   rangeNm: 3300, maxPaxEco: 180, maxPaxBiz: 16, fuelCapacityGal: 6300,  ceilingFt: 39000, cruiseSpeedKts: 447 },
  { icaoType: "A20N", name: "A320neo",       manufacturer: "Airbus",   rangeNm: 3500, maxPaxEco: 180, maxPaxBiz: 16, fuelCapacityGal: 6300,  ceilingFt: 39000, cruiseSpeedKts: 450 },
  { icaoType: "A321", name: "A321",          manufacturer: "Airbus",   rangeNm: 3200, maxPaxEco: 220, maxPaxBiz: 20, fuelCapacityGal: 6300,  ceilingFt: 39000, cruiseSpeedKts: 447 },

  // ——— Airbus wide-body ———
  { icaoType: "A332", name: "A330-200",      manufacturer: "Airbus",   rangeNm: 7250, maxPaxEco: 253, maxPaxBiz: 36, fuelCapacityGal: 36760, ceilingFt: 41000, cruiseSpeedKts: 470 },
  { icaoType: "A333", name: "A330-300",      manufacturer: "Airbus",   rangeNm: 6350, maxPaxEco: 295, maxPaxBiz: 36, fuelCapacityGal: 36760, ceilingFt: 41000, cruiseSpeedKts: 470 },
  { icaoType: "A339", name: "A330-900neo",   manufacturer: "Airbus",   rangeNm: 7200, maxPaxEco: 287, maxPaxBiz: 36, fuelCapacityGal: 36760, ceilingFt: 41000, cruiseSpeedKts: 470 },
  { icaoType: "A342", name: "A340-200",      manufacturer: "Airbus",   rangeNm: 8000, maxPaxEco: 261, maxPaxBiz: 30, fuelCapacityGal: 39060, ceilingFt: 41000, cruiseSpeedKts: 470 },
  { icaoType: "A346", name: "A340-600",      manufacturer: "Airbus",   rangeNm: 7900, maxPaxEco: 380, maxPaxBiz: 42, fuelCapacityGal: 51750, ceilingFt: 41000, cruiseSpeedKts: 470 },
  { icaoType: "A359", name: "A350-900",      manufacturer: "Airbus",   rangeNm: 8100, maxPaxEco: 315, maxPaxBiz: 40, fuelCapacityGal: 36000, ceilingFt: 43000, cruiseSpeedKts: 488 },
  { icaoType: "A35K", name: "A350-1000",     manufacturer: "Airbus",   rangeNm: 8700, maxPaxEco: 366, maxPaxBiz: 44, fuelCapacityGal: 36000, ceilingFt: 43000, cruiseSpeedKts: 488 },
  { icaoType: "A388", name: "A380-800",      manufacturer: "Airbus",   rangeNm: 8000, maxPaxEco: 555, maxPaxBiz: 60, fuelCapacityGal: 81890, ceilingFt: 43000, cruiseSpeedKts: 480 },

  // ——— Boeing narrow-body ———
  { icaoType: "B737", name: "737-700",       manufacturer: "Boeing",   rangeNm: 3010, maxPaxEco: 137, maxPaxBiz: 12, fuelCapacityGal: 6875,  ceilingFt: 41000, cruiseSpeedKts: 453 },
  { icaoType: "B738", name: "737-800",       manufacturer: "Boeing",   rangeNm: 2935, maxPaxEco: 184, maxPaxBiz: 16, fuelCapacityGal: 6875,  ceilingFt: 41000, cruiseSpeedKts: 453 },
  { icaoType: "B739", name: "737-900ER",     manufacturer: "Boeing",   rangeNm: 2950, maxPaxEco: 204, maxPaxBiz: 16, fuelCapacityGal: 6875,  ceilingFt: 41000, cruiseSpeedKts: 453 },
  { icaoType: "B38M", name: "737 MAX 8",     manufacturer: "Boeing",   rangeNm: 3515, maxPaxEco: 189, maxPaxBiz: 16, fuelCapacityGal: 6875,  ceilingFt: 41000, cruiseSpeedKts: 453 },

  // ——— Boeing wide-body ———
  { icaoType: "B752", name: "757-200",       manufacturer: "Boeing",   rangeNm: 3915, maxPaxEco: 200, maxPaxBiz: 24, fuelCapacityGal: 11489, ceilingFt: 42000, cruiseSpeedKts: 461 },
  { icaoType: "B763", name: "767-300ER",     manufacturer: "Boeing",   rangeNm: 5990, maxPaxEco: 269, maxPaxBiz: 30, fuelCapacityGal: 24140, ceilingFt: 43000, cruiseSpeedKts: 459 },
  { icaoType: "B77W", name: "777-300ER",     manufacturer: "Boeing",   rangeNm: 7370, maxPaxEco: 396, maxPaxBiz: 42, fuelCapacityGal: 47890, ceilingFt: 43100, cruiseSpeedKts: 490 },
  { icaoType: "B77L", name: "777-200LR",     manufacturer: "Boeing",   rangeNm: 8555, maxPaxEco: 301, maxPaxBiz: 36, fuelCapacityGal: 47890, ceilingFt: 43100, cruiseSpeedKts: 490 },
  { icaoType: "B748", name: "747-8",         manufacturer: "Boeing",   rangeNm: 7730, maxPaxEco: 410, maxPaxBiz: 48, fuelCapacityGal: 63034, ceilingFt: 43100, cruiseSpeedKts: 490 },
  { icaoType: "B78X", name: "787-10",        manufacturer: "Boeing",   rangeNm: 6430, maxPaxEco: 330, maxPaxBiz: 36, fuelCapacityGal: 33384, ceilingFt: 43000, cruiseSpeedKts: 488 },
  { icaoType: "B789", name: "787-9",         manufacturer: "Boeing",   rangeNm: 7635, maxPaxEco: 296, maxPaxBiz: 28, fuelCapacityGal: 33384, ceilingFt: 43000, cruiseSpeedKts: 488 },
  { icaoType: "B788", name: "787-8",         manufacturer: "Boeing",   rangeNm: 7355, maxPaxEco: 242, maxPaxBiz: 22, fuelCapacityGal: 33384, ceilingFt: 43000, cruiseSpeedKts: 488 },

  // ——— Regional jets ———
  { icaoType: "CRJ7", name: "CRJ-700",      manufacturer: "Bombardier", rangeNm: 1378, maxPaxEco: 70,  maxPaxBiz: 6,  fuelCapacityGal: 2740,  ceilingFt: 41000, cruiseSpeedKts: 447 },
  { icaoType: "CRJ9", name: "CRJ-900",      manufacturer: "Bombardier", rangeNm: 1350, maxPaxEco: 86,  maxPaxBiz: 6,  fuelCapacityGal: 2740,  ceilingFt: 41000, cruiseSpeedKts: 447 },
  { icaoType: "E170", name: "E170",          manufacturer: "Embraer",  rangeNm: 2100, maxPaxEco: 72,  maxPaxBiz: 6,  fuelCapacityGal: 3530,  ceilingFt: 41000, cruiseSpeedKts: 430 },
  { icaoType: "E190", name: "E190",          manufacturer: "Embraer",  rangeNm: 2450, maxPaxEco: 100, maxPaxBiz: 10, fuelCapacityGal: 3530,  ceilingFt: 41000, cruiseSpeedKts: 430 },
  { icaoType: "E295", name: "E195-E2",       manufacturer: "Embraer",  rangeNm: 2600, maxPaxEco: 132, maxPaxBiz: 12, fuelCapacityGal: 3670,  ceilingFt: 41000, cruiseSpeedKts: 440 },

  // ——— Turboprops ———
  { icaoType: "AT76", name: "ATR 72-600",    manufacturer: "ATR",      rangeNm: 825,  maxPaxEco: 72,  maxPaxBiz: 0,  fuelCapacityGal: 1440,  ceilingFt: 25000, cruiseSpeedKts: 275 },
  { icaoType: "DH8D", name: "Dash 8 Q400",  manufacturer: "De Havilland", rangeNm: 1100, maxPaxEco: 78, maxPaxBiz: 0, fuelCapacityGal: 1554, ceilingFt: 27000, cruiseSpeedKts: 310 },

  // ——— GA / Light ———
  { icaoType: "C172", name: "Cessna 172",    manufacturer: "Cessna",   rangeNm: 640,  maxPaxEco: 3,   maxPaxBiz: 0,  fuelCapacityGal: 56,    ceilingFt: 14000, cruiseSpeedKts: 122 },
  { icaoType: "C208", name: "Caravan 208",   manufacturer: "Cessna",   rangeNm: 1070, maxPaxEco: 9,   maxPaxBiz: 0,  fuelCapacityGal: 335,   ceilingFt: 25000, cruiseSpeedKts: 186 },
  { icaoType: "TBM9", name: "TBM 930",       manufacturer: "Daher",    rangeNm: 1730, maxPaxEco: 5,   maxPaxBiz: 0,  fuelCapacityGal: 282,   ceilingFt: 31000, cruiseSpeedKts: 330 },
  { icaoType: "PC12", name: "PC-12",         manufacturer: "Pilatus",  rangeNm: 1845, maxPaxEco: 9,   maxPaxBiz: 0,  fuelCapacityGal: 402,   ceilingFt: 30000, cruiseSpeedKts: 280 },
  { icaoType: "BE58", name: "Baron 58",      manufacturer: "Beechcraft", rangeNm: 1225, maxPaxEco: 5, maxPaxBiz: 0,  fuelCapacityGal: 194,   ceilingFt: 20688, cruiseSpeedKts: 200 },
];

export const aircraftTypeByIcao: Record<string, AircraftType> = Object.fromEntries(
  aircraftTypes.map((t) => [t.icaoType, t]),
);
