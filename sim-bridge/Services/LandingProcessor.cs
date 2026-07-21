using System.Net.Http.Headers;
using System.Net.Http.Json;
using Thrustline.Bridge.Session;
using Thrustline.Bridge.SimConnect;

namespace Thrustline.Bridge.Services;

/// <summary>Forwards raw landing telemetry to the authenticated server operation.</summary>
public sealed class LandingProcessor(
    ISessionStore sessionStore,
    PassengerExperienceService passengerExperience,
    IHttpClientFactory httpClientFactory,
    ILogger<LandingProcessor> log)
{
    public async Task ProcessAsync(LandingEvent evt, CancellationToken ct = default)
    {
        var session = sessionStore.Current;
        if (session is null)
        {
            log.LogWarning("Landing detected without an authenticated backend session");
            return;
        }

        var operationId = Guid.NewGuid();
        var completedExperience = passengerExperience.Completed;
        var payload = new
        {
            operationId,
            evt.DistanceNm,
            evt.FuelUsedGal,
            evt.DurationMin,
            evt.LandingVsFpm,
            paxSatisfaction = completedExperience?.Satisfaction,
        };
        var endpoint = new Uri(session.SupabaseUrl, "/functions/v1/complete-flight");

        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
                request.Content = JsonContent.Create(payload);
                using var response = await httpClientFactory.CreateClient().SendAsync(request, ct);
                if (response.IsSuccessStatusCode)
                {
                    log.LogInformation("Landing finalized by server operation {OperationId}", operationId);
                    return;
                }

                var error = await response.Content.ReadAsStringAsync(ct);
                if ((int)response.StatusCode is >= 400 and < 500)
                {
                    log.LogWarning("Landing rejected by backend ({Status}): {Error}", response.StatusCode, error);
                    return;
                }
                log.LogWarning("Landing backend attempt {Attempt} failed with {Status}", attempt, response.StatusCode);
            }
            catch (HttpRequestException ex) when (attempt < 3)
            {
                log.LogWarning(ex, "Landing backend attempt {Attempt} failed", attempt);
            }

            if (attempt < 3) await Task.Delay(TimeSpan.FromSeconds(attempt * 2), ct);
        }
        log.LogError("Landing operation {OperationId} could not be persisted after retries", operationId);
    }
}
