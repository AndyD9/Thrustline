using Thrustline.Models;
using Thrustline.Services.SimConnect;

namespace Thrustline.Messages;

// ── Sim ──────────────────────────────────────────────────────────────────
public record SimDataMessage(SimData Data);
public record SimStatusMessage(string Status);

// ── Flight lifecycle ─────────────────────────────────────────────────────
public record FlightStartedMessage(string DepartureIcao);
public record FlightEndedMessage(Flight Flight, FlightRecord Record, double NetResult, bool IsHardLanding, bool Grounded, double? HealthAfter);

// ── Monthly deductions ───────────────────────────────────────────────────
public record LeaseDeductedMessage(double Total, int AircraftCount);
public record SalaryDeductedMessage(double Total, int CrewCount);
public record LoanPaymentMessage(double Payment, int PaidMonths, int TotalMonths, double Remaining);

// ── Events ───────────────────────────────────────────────────────────────
public record GameEventNewMessage(GameEvent Event);
public record GameEventExpiredMessage(int Count);

// ── Dispatch ─────────────────────────────────────────────────────────────
public record DispatchUpdatedMessage;

// ── Aircraft ─────────────────────────────────────────────────────────────
public record AircraftChangedMessage(string? AircraftId, string? IcaoType);

// ── Sync ─────────────────────────────────────────────────────────────────
public record SyncStatusMessage(string Status);

// ── Auth ─────────────────────────────────────────────────────────────────
public record AuthChangedMessage(string? UserId);
