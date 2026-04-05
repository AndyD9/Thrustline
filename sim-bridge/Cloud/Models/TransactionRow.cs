using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("transactions")]
public class TransactionRow : BaseModel
{
    public const string TypeRevenue     = "revenue";
    public const string TypeFuel        = "fuel";
    public const string TypeLandingFee  = "landing_fee";
    public const string TypeLease       = "lease";
    public const string TypeMaintenance = "maintenance";
    public const string TypeSalary      = "salary";
    public const string TypePurchase    = "purchase";
    public const string TypeSale        = "sale";
    public const string TypeLoanPayment = "loan_payment";

    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("flight_id")]
    public Guid? FlightId { get; set; }

    [Column("type")]
    public string Type { get; set; } = "";

    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("description")]
    public string Description { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
