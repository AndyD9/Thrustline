namespace Thrustline.Data;

public record AircraftCatalogEntry(
    string Name,
    string IcaoType,
    string Category,      // regional | narrowbody | widebody
    double LeaseCostMo,
    double PurchasePrice,
    int SeatsEco,
    int SeatsBiz,
    double RangeNm,
    double CruiseKtas,
    double FuelBurnGalH,
    double FuelLbsPerNm,
    double MtowLbs
);

public static class AircraftCatalog
{
    public static readonly IReadOnlyList<AircraftCatalogEntry> All = new[]
    {
        // ── Regional / Turboprop ────────────────────────────────────────
        new AircraftCatalogEntry("ATR 72-600",          "AT76", "regional",   15_000,    300_000,  68,  0,  825, 275,  240,  18,  50_700),
        new AircraftCatalogEntry("Embraer E175",        "E175", "regional",   22_000,    440_000,  72, 12, 2000, 470,  450,  25,  82_700),
        new AircraftCatalogEntry("Embraer E190",        "E190", "regional",   28_000,    560_000,  88, 12, 2450, 470,  500,  28, 105_400),

        // ── Narrowbody ──────────────────────────────────────────────────
        new AircraftCatalogEntry("Airbus A319neo",      "A19N", "narrowbody", 35_000,    700_000, 120,  8, 3700, 450,  600,  38, 166_500),
        new AircraftCatalogEntry("Airbus A320neo",      "A20N", "narrowbody", 42_000,    840_000, 150, 15, 3400, 450,  650,  40, 174_200),
        new AircraftCatalogEntry("Airbus A321neo",      "A21N", "narrowbody", 52_000,  1_040_000, 182, 20, 4000, 450,  720,  47, 213_800),
        new AircraftCatalogEntry("Boeing 737-800",      "B738", "narrowbody", 45_000,    900_000, 150, 12, 2935, 453,  850,  45, 174_200),
        new AircraftCatalogEntry("Boeing 737 MAX 8",    "B38M", "narrowbody", 48_000,    960_000, 162, 12, 3550, 453,  720,  42, 182_200),

        // ── Widebody ────────────────────────────────────────────────────
        new AircraftCatalogEntry("Airbus A330-300",     "A333", "widebody",   85_000,  1_700_000, 277, 30, 6350, 470, 1650, 125, 513_700),
        new AircraftCatalogEntry("Airbus A330-900neo",  "A339", "widebody",   92_000,  1_840_000, 260, 30, 7200, 470, 1450, 110, 533_500),
        new AircraftCatalogEntry("Boeing 787-9",        "B789", "widebody",   95_000,  1_900_000, 296, 28, 7635, 488, 1400, 105, 560_000),
        new AircraftCatalogEntry("Airbus A350-900",     "A359", "widebody",  115_000,  2_300_000, 315, 40, 8100, 488, 1500, 115, 617_300),
        new AircraftCatalogEntry("Boeing 777-300ER",    "B77W", "widebody",  130_000,  2_600_000, 350, 46, 7370, 490, 2300, 175, 775_000),
        new AircraftCatalogEntry("Airbus A380-800",     "A388", "widebody",  180_000,  3_600_000, 500, 55, 8000, 490, 2900, 200, 1_268_000),
    };

    public static readonly IReadOnlyDictionary<string, AircraftCatalogEntry> ByType =
        All.ToDictionary(a => a.IcaoType);

    public static AircraftCatalogEntry? Get(string icaoType) =>
        ByType.TryGetValue(icaoType, out var entry) ? entry : null;
}
