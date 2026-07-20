// Monthly billing cycle — deducts crew salaries, aircraft leases, and loan payments

import { supabase } from "./supabase";
import { maybeGenerateEvents } from "./gameEvents";
import type { Company, CrewMember, Aircraft, AircraftLease, Loan, Partnership, MarketingCampaign, TransactionType } from "./database.types";

const BILLING_INTERVAL_DAYS = 30;

export interface BillingResult {
  monthsBilled: number;
  totalSalaries: number;
  totalLeases: number;
  totalLoanPayments: number;
  totalPartnerships: number;
  totalCampaigns: number;
  totalDeducted: number;
  details: string[];
}

/** Check if a billing cycle is due (>30 days since last billing). Returns months owed. */
export function monthsDue(company: Company): number {
  const lastBilling = company.last_billing_at ? new Date(company.last_billing_at) : new Date(company.created_at);
  const now = new Date();
  const daysSince = (now.getTime() - lastBilling.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(daysSince / BILLING_INTERVAL_DAYS);
}

/** Run the billing cycle for a company. Returns summary of what was deducted. */
export async function runBillingCycle(company: Company): Promise<BillingResult | null> {
  const months = monthsDue(company);
  if (months <= 0) return null;

  const { data: leaseBillingData, error: leaseBillingError } = await supabase.rpc("process_aircraft_lease_payments", {
    p_company_id: company.id,
    p_months: months,
  });
  if (leaseBillingError) console.error("[Billing] lease payments failed:", leaseBillingError);
  const leaseBilling = leaseBillingData && typeof leaseBillingData === "object" && !Array.isArray(leaseBillingData)
    ? leaseBillingData as { total_paid?: number; payments?: number; overdue?: number }
    : {};

  // Legacy leases without a finance contract keep their historical flat charge.
  const [crewRes, aircraftRes, leaseContractsRes, loansRes, partnershipsRes, campaignsRes] = await Promise.all([
    supabase.from("crew_members").select("*").eq("company_id", company.id),
    supabase.from("aircraft").select("*").eq("company_id", company.id).eq("ownership", "leased"),
    supabase.from("aircraft_leases").select("*").eq("company_id", company.id),
    supabase.from("loans").select("*").eq("company_id", company.id).gt("remaining_amount", 0),
    supabase.from("partnerships").select("*").eq("company_id", company.id).eq("active", true),
    supabase.from("marketing_campaigns").select("*").eq("company_id", company.id).gt("expires_at", new Date().toISOString()),
  ]);

  const crew = (crewRes.data as CrewMember[]) ?? [];
  const leasedAircraft = (aircraftRes.data as Aircraft[]) ?? [];
  const leaseContracts = (leaseContractsRes.data as AircraftLease[]) ?? [];
  const loans = (loansRes.data as Loan[]) ?? [];
  const partnerships = (partnershipsRes.data as Partnership[]) ?? [];
  const campaigns = (campaignsRes.data as MarketingCampaign[]) ?? [];

  // Calculate monthly totals
  const monthlySalaries = crew.reduce((sum, c) => sum + c.salary_mo, 0);
  const contractedAircraftIds = new Set(leaseContracts.map((contract) => contract.aircraft_id));
  const legacyLeasedAircraft = leasedAircraft.filter((aircraft) => !contractedAircraftIds.has(aircraft.id));
  const monthlyLegacyLeases = legacyLeasedAircraft.reduce((sum, aircraft) => sum + aircraft.lease_cost_mo, 0);
  const monthlyLoanPayments = loans.reduce((sum, l) => sum + l.monthly_payment, 0);
  const monthlyPartnerships = partnerships.reduce((sum, p) => sum + p.monthly_cost, 0);

  // Campaign costs: pro-rate daily cost for days active within the billing period
  const now = new Date();
  const billingDays = months * BILLING_INTERVAL_DAYS;
  const campaignCosts = campaigns.reduce((sum, c) => {
    const start = new Date(c.started_at);
    const end = new Date(c.expires_at);
    const overlapStart = Math.max(start.getTime(), now.getTime() - billingDays * 86400000);
    const overlapEnd = Math.min(end.getTime(), now.getTime());
    const activeDays = Math.max(0, (overlapEnd - overlapStart) / 86400000);
    return sum + c.daily_cost * activeDays;
  }, 0);

  const totalSalaries = monthlySalaries * months;
  const totalLeases = monthlyLegacyLeases * months + Number(leaseBilling.total_paid ?? 0);
  const totalLoanPayments = monthlyLoanPayments * months;
  const totalPartnerships = monthlyPartnerships * months;
  const totalCampaigns = Math.round(campaignCosts);
  const totalDeducted = totalSalaries + totalLeases + totalLoanPayments + totalPartnerships + totalCampaigns;

  const details: string[] = [];
  const transactions: Array<{
    user_id: string;
    company_id: string;
    type: TransactionType;
    amount: number;
    description: string;
  }> = [];

  // Build transactions for each month
  for (let m = 0; m < months; m++) {
    const monthLabel = months > 1 ? ` (month ${m + 1}/${months})` : "";

    if (monthlySalaries > 0) {
      transactions.push({
        user_id: company.user_id,
        company_id: company.id,
        type: "salary",
        amount: -monthlySalaries,
        description: `Crew salaries${monthLabel} — ${crew.length} members`,
      });
    }

    if (monthlyLegacyLeases > 0) {
      transactions.push({
        user_id: company.user_id,
        company_id: company.id,
        type: "lease",
        amount: -monthlyLegacyLeases,
        description: `Aircraft leases${monthLabel} — ${legacyLeasedAircraft.length} aircraft`,
      });
    }

    if (monthlyLoanPayments > 0) {
      transactions.push({
        user_id: company.user_id,
        company_id: company.id,
        type: "loan_payment",
        amount: -monthlyLoanPayments,
        description: `Loan payments${monthLabel} — ${loans.length} loans`,
      });
    }

    if (monthlyPartnerships > 0) {
      transactions.push({
        user_id: company.user_id,
        company_id: company.id,
        type: "maintenance", // reuse existing type for partnership costs
        amount: -monthlyPartnerships,
        description: `Partnership fees${monthLabel} — ${partnerships.length} partners`,
      });
    }
  }

  // Campaign costs (single transaction, not per-month)
  if (totalCampaigns > 0) {
    transactions.push({
      user_id: company.user_id,
      company_id: company.id,
      type: "maintenance", // reuse existing type
      amount: -totalCampaigns,
      description: `Marketing campaign costs — ${campaigns.length} active campaigns`,
    });
  }

  if (totalSalaries > 0) details.push(`Salaries: -$${totalSalaries.toLocaleString()} (${crew.length} crew × ${months} mo)`);
  if (totalLeases > 0) details.push(`Aircraft financing: -$${totalLeases.toLocaleString()} (${Number(leaseBilling.payments ?? 0)} lease-to-own payments)`);
  if (Number(leaseBilling.overdue ?? 0) > 0) details.push(`${leaseBilling.overdue} lease payment(s) overdue — dispatch blocked`);
  if (totalLoanPayments > 0) details.push(`Loan payments: -$${totalLoanPayments.toLocaleString()} (${loans.length} loans × ${months} mo)`);
  if (totalPartnerships > 0) details.push(`Partnerships: -$${totalPartnerships.toLocaleString()} (${partnerships.length} partners × ${months} mo)`);
  if (totalCampaigns > 0) details.push(`Marketing: -$${totalCampaigns.toLocaleString()} (${campaigns.length} campaigns)`);

  // Write transactions
  if (transactions.length > 0) {
    await supabase.from("transactions").insert(transactions);
  }

  // The lease RPC already changed capital. Deduct other charges from its fresh balance.
  const { data: freshCompany } = await supabase.from("companies").select("capital").eq("id", company.id).single();
  const capitalAfterLeasePayments = Number(freshCompany?.capital ?? company.capital);
  const remainingCharges = totalDeducted - Number(leaseBilling.total_paid ?? 0);
  await supabase
    .from("companies")
    .update({
      capital: capitalAfterLeasePayments - remainingCharges,
      last_billing_at: new Date().toISOString(),
    })
    .eq("id", company.id);

  // Update loan paid_months
  for (const loan of loans) {
    const newPaid = loan.paid_months + months;
    const newRemaining = Math.max(0, loan.remaining_amount - loan.monthly_payment * months);
    await supabase
      .from("loans")
      .update({
        paid_months: newPaid,
        remaining_amount: newRemaining,
      })
      .eq("id", loan.id);
  }

  // Maybe generate random world events (~30% chance per billing cycle)
  const eventsGenerated = await maybeGenerateEvents(company.id, company.user_id);
  if (eventsGenerated > 0) {
    details.push(`${eventsGenerated} new world event${eventsGenerated > 1 ? "s" : ""} occurred!`);
  }

  return { monthsBilled: months, totalSalaries, totalLeases, totalLoanPayments, totalPartnerships, totalCampaigns, totalDeducted, details };
}
