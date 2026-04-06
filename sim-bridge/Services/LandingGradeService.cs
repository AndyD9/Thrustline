namespace Thrustline.Bridge.Services;

/// <summary>
/// Grade chaque atterrissage de A+ (butter) a F (dangereux)
/// base sur la vitesse verticale au touchdown.
/// </summary>
public class LandingGradeService
{
    public record GradeResult(string Grade, string Label);

    /// <summary>
    /// Calcule le grade a partir du VS au touchdown (en fpm, signe quelconque).
    /// </summary>
    public GradeResult Compute(decimal landingVsFpm)
    {
        var absVs = Math.Abs(landingVsFpm);
        return absVs switch
        {
            < 60m   => new("A+", "Butter"),
            < 100m  => new("A",  "Excellent"),
            < 150m  => new("B+", "Greaser"),
            < 200m  => new("B",  "Very Nice"),
            < 300m  => new("C+", "Good"),
            < 400m  => new("C",  "Acceptable"),
            < 600m  => new("D",  "Firm"),
            < 800m  => new("D-", "Hard"),
            < 1000m => new("F+", "Very Hard"),
            _       => new("F",  "Dangerous"),
        };
    }
}
