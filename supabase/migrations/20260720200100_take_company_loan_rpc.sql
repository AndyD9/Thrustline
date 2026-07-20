create or replace function public.take_company_loan(
  p_company_id uuid,
  p_principal numeric,
  p_monthly_payment numeric,
  p_remaining_amount numeric,
  p_total_months integer,
  p_interest_rate numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  company_row public.companies%rowtype;
  new_loan_id uuid;
begin
  if p_principal <= 0 or p_monthly_payment <= 0 or p_remaining_amount < p_principal
     or p_total_months < 1 or p_interest_rate < 0 then
    raise exception 'Invalid loan terms';
  end if;

  select * into company_row
  from public.companies
  where id = p_company_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Company not found';
  end if;

  if company_row.capital < 0 or p_principal > company_row.capital * 3 then
    raise exception 'Loan exceeds borrowing limit';
  end if;

  insert into public.loans (
    user_id, company_id, principal, monthly_payment, remaining_amount,
    total_months, paid_months, interest_rate
  ) values (
    auth.uid(), p_company_id, p_principal, p_monthly_payment, p_remaining_amount,
    p_total_months, 0, p_interest_rate
  ) returning id into new_loan_id;

  update public.companies
  set capital = capital + p_principal
  where id = p_company_id;

  insert into public.transactions (user_id, company_id, type, amount, description)
  values (
    auth.uid(), p_company_id, 'loan_received', p_principal,
    format('Loan received — $%s over %s months at %s%% APR', p_principal, p_total_months, p_interest_rate)
  );

  return new_loan_id;
end;
$$;

grant execute on function public.take_company_loan(uuid, numeric, numeric, numeric, integer, numeric) to authenticated;
