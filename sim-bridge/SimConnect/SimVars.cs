namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// Liste des SimVars suivies, avec unité MSFS attendue.
/// Utilisée par le client SimConnect réel (Windows) pour l'enregistrement.
/// </summary>
public static class SimVars
{
    public static readonly (string Name, string Unit)[] All =
    {
        ("PLANE LATITUDE",          "degrees"),
        ("PLANE LONGITUDE",         "degrees"),
        ("PLANE ALTITUDE",          "feet"),
        ("GROUND VELOCITY",         "knots"),
        ("AIRSPEED INDICATED",      "knots"),
        ("PLANE HEADING DEGREES TRUE", "degrees"),
        ("VERTICAL SPEED",          "feet per minute"),
        ("FUEL TOTAL QUANTITY",     "gallons"),
        ("SIM ON GROUND",           "bool"),
    };
}
