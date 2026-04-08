using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CommunityToolkit.Mvvm.Messaging;
using Thrustline.Messages;

namespace Thrustline.Services.Auth;

public record AuthSession(string AccessToken, string RefreshToken, string UserId, string? Email);

public class SupabaseAuthService
{
    private readonly string _supabaseUrl;
    private readonly string _anonKey;
    private readonly HttpClient _http = new();
    private AuthSession? _session;

    public AuthSession? Session => _session;
    public string? UserId => _session?.UserId;
    public bool IsAuthenticated => _session != null;

    public SupabaseAuthService(string supabaseUrl, string anonKey)
    {
        _supabaseUrl = supabaseUrl.TrimEnd('/');
        _anonKey = anonKey;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path, object? body = null)
    {
        var req = new HttpRequestMessage(method, $"{_supabaseUrl}{path}");
        req.Headers.Add("apikey", _anonKey);
        if (_session != null)
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _session.AccessToken);
        if (body != null)
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        return req;
    }

    public async Task<AuthSession> SignUpAsync(string email, string password)
    {
        var req = CreateRequest(HttpMethod.Post, "/auth/v1/signup", new { email, password });
        var res = await _http.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new InvalidOperationException($"Sign up failed: {json}");

        return ParseAuthResponse(json);
    }

    public async Task<AuthSession> SignInWithPasswordAsync(string email, string password)
    {
        var req = CreateRequest(HttpMethod.Post, "/auth/v1/token?grant_type=password", new { email, password });
        var res = await _http.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new InvalidOperationException($"Sign in failed: {json}");

        _session = ParseAuthResponse(json);
        WeakReferenceMessenger.Default.Send(new AuthChangedMessage(_session.UserId));
        return _session;
    }

    public void SignInWithOAuth(string provider)
    {
        var redirectTo = Uri.EscapeDataString("thrustline://auth/callback");
        var url = $"{_supabaseUrl}/auth/v1/authorize?provider={provider}&redirect_to={redirectTo}";
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    public async Task HandleOAuthCallbackAsync(string accessToken, string refreshToken)
    {
        _session = new AuthSession(accessToken, refreshToken, "", null);
        // Fetch user info
        var req = CreateRequest(HttpMethod.Get, "/auth/v1/user");
        var res = await _http.SendAsync(req);
        if (res.IsSuccessStatusCode)
        {
            var json = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var userId = doc.RootElement.GetProperty("id").GetString() ?? "";
            var email = doc.RootElement.TryGetProperty("email", out var e) ? e.GetString() : null;
            _session = _session with { UserId = userId, Email = email };
        }
        WeakReferenceMessenger.Default.Send(new AuthChangedMessage(_session.UserId));
    }

    public async Task SignOutAsync()
    {
        if (_session != null)
        {
            try
            {
                var req = CreateRequest(HttpMethod.Post, "/auth/v1/logout");
                await _http.SendAsync(req);
            }
            catch { /* best effort */ }
        }
        _session = null;
        WeakReferenceMessenger.Default.Send(new AuthChangedMessage(null));
    }

    public async Task<AuthSession?> RefreshSessionAsync()
    {
        if (_session?.RefreshToken == null) return null;
        try
        {
            var req = CreateRequest(HttpMethod.Post, "/auth/v1/token?grant_type=refresh_token",
                new { refresh_token = _session.RefreshToken });
            var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode) return null;
            var json = await res.Content.ReadAsStringAsync();
            _session = ParseAuthResponse(json);
            return _session;
        }
        catch { return null; }
    }

    private AuthSession ParseAuthResponse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var accessToken = root.TryGetProperty("access_token", out var at) ? at.GetString() ?? "" : "";
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() ?? "" : "";

        string userId = "", email = "";
        if (root.TryGetProperty("user", out var user))
        {
            userId = user.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
            email = user.TryGetProperty("email", out var em) ? em.GetString() ?? "" : "";
        }

        return new AuthSession(accessToken, refreshToken, userId, email);
    }
}
