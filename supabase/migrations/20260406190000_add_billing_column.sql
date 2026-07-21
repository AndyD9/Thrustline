-- Add last_billing_at to track monthly billing cycles
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_billing_at timestamptz DEFAULT now();
