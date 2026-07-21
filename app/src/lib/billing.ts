import { supabase } from "./supabase";
import type { Company } from "./database.types";

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

export function monthsDue(company: Company): number {
  const lastBilling = company.last_billing_at ? new Date(company.last_billing_at) : new Date(company.created_at);
  return Math.floor((Date.now() - lastBilling.getTime()) / (BILLING_INTERVAL_DAYS * 86_400_000));
}

export async function runBillingCycle(company: Company): Promise<BillingResult | null> {
  if (monthsDue(company) <= 0) return null;
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: { p_company_id: string },
  ) => Promise<{ data: Omit<BillingResult, "details"> | null; error: { message: string } | null }>;
  const { data, error } = await invoke("run_billing_cycle", { p_company_id: company.id });
  if (error) throw new Error(error.message);
  if (!data || Number(data.monthsBilled) <= 0) return null;

  const result = {
    monthsBilled: Number(data.monthsBilled),
    totalSalaries: Number(data.totalSalaries ?? 0),
    totalLeases: Number(data.totalLeases ?? 0),
    totalLoanPayments: Number(data.totalLoanPayments ?? 0),
    totalPartnerships: Number(data.totalPartnerships ?? 0),
    totalCampaigns: Number(data.totalCampaigns ?? 0),
    totalDeducted: Number(data.totalDeducted ?? 0),
  };
  const details = [
    result.totalSalaries > 0 ? `Salaries: -$${result.totalSalaries.toLocaleString()}` : "",
    result.totalLeases > 0 ? `Aircraft financing: -$${result.totalLeases.toLocaleString()}` : "",
    result.totalLoanPayments > 0 ? `Loan payments: -$${result.totalLoanPayments.toLocaleString()}` : "",
    result.totalPartnerships > 0 ? `Partnerships: -$${result.totalPartnerships.toLocaleString()}` : "",
    result.totalCampaigns > 0 ? `Marketing: -$${result.totalCampaigns.toLocaleString()}` : "",
  ].filter(Boolean);
  return { ...result, details };
}
