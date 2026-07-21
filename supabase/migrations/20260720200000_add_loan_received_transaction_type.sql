-- Loan proceeds increase cash but are not operating revenue or a sale.
alter type public.transaction_type add value if not exists 'loan_received' after 'revenue';
