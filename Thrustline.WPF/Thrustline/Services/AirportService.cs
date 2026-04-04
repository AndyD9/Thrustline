using System.Reflection;
using System.Text.Json;

namespace Thrustline.Services;

public record AirportInfo(string Icao, string Name, string City, string Country, double Lat, double Lon);

public class AirportService
{
    private readonly Dictionary<string, AirportInfo> _db = new(StringComparer.OrdinalIgnoreCase);
    private const double EarthRadiusNm = 3440.065;

    public int Count => _db.Count;

    public void Load()
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("Thrustline.Assets.airports-db.json")
            ?? throw new InvalidOperationException("airports-db.json embedded resource not found.");

        var airports = JsonSerializer.Deserialize<AirportInfo[]>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (airports is null) return;

        foreach (var a in airports)
            _db[a.Icao] = a;
    }

    public AirportInfo? GetAirport(string icao) =>
        _db.TryGetValue(icao.ToUpperInvariant(), out var info) ? info : null;

    public bool IsKnown(string icao) =>
        _db.ContainsKey(icao.ToUpperInvariant());

    public AirportInfo? FindNearest(double lat, double lon, double maxDistNm = 40)
    {
        AirportInfo? best = null;
        var bestDist = maxDistNm;

        foreach (var airport in _db.Values)
        {
            var d = HaversineNm(lat, lon, airport.Lat, airport.Lon);
            if (d < bestDist)
            {
                bestDist = d;
                best = airport;
            }
        }

        return best;
    }

    public static double HaversineNm(double lat1, double lon1, double lat2, double lon2)
    {
        var toRad = Math.PI / 180.0;
        var dLat = (lat2 - lat1) * toRad;
        var dLon = (lon2 - lon1) * toRad;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1 * toRad) * Math.Cos(lat2 * toRad)
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return EarthRadiusNm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
