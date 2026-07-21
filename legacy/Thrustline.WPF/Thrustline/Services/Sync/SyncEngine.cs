using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CommunityToolkit.Mvvm.Messaging;
using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Messages;

namespace Thrustline.Services.Sync;

public class SyncEngine : IDisposable
{
    private readonly IDbContextFactory<ThrustlineDbContext> _dbFactory;
    private readonly HttpClient _http;
    private readonly string _supabaseUrl;
    private readonly string _anonKey;
    private string? _accessToken;
    private string? _userId;
    private Timer? _timer;
    private string _status = "idle";

    private static readonly Dictionary<string, string> TableMap = new()
    {
        ["Company"] = "companies", ["Aircraft"] = "aircraft", ["Flight"] = "flights",
        ["Transaction"] = "transactions", ["Route"] = "routes", ["Dispatch"] = "dispatches",
        ["CrewMember"] = "crew_members", ["Loan"] = "loans", ["GameEvent"] = "game_events",
        ["Reputation"] = "reputations",
    };

    public string Status => _status;

    public SyncEngine(IDbContextFactory<ThrustlineDbContext> dbFactory, string supabaseUrl, string anonKey)
    {
        _dbFactory = dbFactory;
        _supabaseUrl = supabaseUrl.TrimEnd('/');
        _anonKey = anonKey;
        _http = new HttpClient();
    }

    public void Configure(string accessToken, string userId)
    {
        _accessToken = accessToken;
        _userId = userId;
    }

    public void Start()
    {
        _timer ??= new Timer(async _ => await PushNowAsync(), null, TimeSpan.FromSeconds(60), TimeSpan.FromSeconds(60));
    }

    public void Stop()
    {
        _timer?.Dispose();
        _timer = null;
    }

    private void SetStatus(string s)
    {
        _status = s;
        WeakReferenceMessenger.Default.Send(new SyncStatusMessage(s));
    }

    public async Task PushNowAsync()
    {
        if (_status == "syncing" || _accessToken == null || _userId == null) return;

        SetStatus("syncing");
        try
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            var pending = await db.SyncLogs
                .Where(s => s.SyncedAt == null)
                .OrderBy(s => s.CreatedAt)
                .Take(200)
                .ToListAsync();

            if (pending.Count == 0) { SetStatus("idle"); return; }

            var grouped = pending.GroupBy(e => e.TableName);

            foreach (var group in grouped)
            {
                if (!TableMap.TryGetValue(group.Key, out var supaTable)) continue;

                // Deletes
                var deletes = group.Where(e => e.Action == "delete").ToList();
                if (deletes.Count > 0)
                {
                    var ids = string.Join(",", deletes.Select(e => $"\"{e.RecordId}\""));
                    var req = CreateRequest(HttpMethod.Delete, $"/rest/v1/{supaTable}?id=in.({ids})");
                    await _http.SendAsync(req);
                }

                // Upserts
                var upserts = group.Where(e => e.Action != "delete" && e.Payload != null).ToList();
                for (var i = 0; i < upserts.Count; i += 50)
                {
                    var batch = upserts.Skip(i).Take(50).Select(e =>
                    {
                        var data = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(e.Payload!);
                        var snake = new Dictionary<string, object?>();
                        if (data != null)
                            foreach (var (k, v) in data)
                                snake[CamelToSnake(k)] = v;
                        snake["user_id"] = _userId;
                        return snake;
                    }).ToList();

                    var json = JsonSerializer.Serialize(batch);
                    var req = CreateRequest(HttpMethod.Post, $"/rest/v1/{supaTable}");
                    req.Headers.Add("Prefer", "resolution=merge-duplicates");
                    req.Content = new StringContent(json, Encoding.UTF8, "application/json");
                    await _http.SendAsync(req);
                }

                // Mark synced
                var ids2 = group.Select(e => e.Id).ToList();
                await db.SyncLogs.Where(s => ids2.Contains(s.Id)).ExecuteUpdateAsync(s => s.SetProperty(x => x.SyncedAt, DateTime.UtcNow));
            }

            SetStatus("idle");
        }
        catch
        {
            SetStatus("error");
        }
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path)
    {
        var req = new HttpRequestMessage(method, $"{_supabaseUrl}{path}");
        req.Headers.Add("apikey", _anonKey);
        if (_accessToken != null)
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
        return req;
    }

    private static string CamelToSnake(string str) =>
        Regex.Replace(str, "([A-Z])", "_$1").ToLowerInvariant().TrimStart('_');

    public void Dispose()
    {
        Stop();
        _http.Dispose();
        GC.SuppressFinalize(this);
    }
}
