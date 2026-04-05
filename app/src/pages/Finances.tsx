import { StubPage } from "@/components/StubPage";

export default function Finances() {
  return (
    <StubPage
      title="Finances"
      description="Ledger of all cash movements + loan management."
      nextSteps={[
        "Last N transactions from supabase.from('transactions')",
        "Monthly P&L chart (revenue, fuel, fees, lease, salary)",
        "Loans: principal, monthly payment, remaining, amortization table",
      ]}
    />
  );
}
