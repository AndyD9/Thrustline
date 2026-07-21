# Security deployment

The desktop application and its sidecar are untrusted public clients. Never place a
Supabase `service_role` key in either binary, configuration files shipped to users,
or .NET user secrets on an end-user machine.

## Deploy

1. Apply migrations, including `20260721190000_security_hardening.sql`, to a staging project.
2. Deploy the server function:

   ```powershell
   supabase functions deploy complete-flight --project-ref <project-ref>
   ```

3. Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Do not copy the service key locally.
4. Build the frontend with only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Run the two-user isolation and idempotency checks below before production promotion.

## Required staging checks

- Anonymous callers cannot execute economy RPCs.
- User A cannot pass user B's company, dispatch, aircraft, campaign, or partnership IDs.
- Calling `complete-flight` twice with the same operation UUID creates exactly one flight.
- A second operation UUID cannot complete an already completed dispatch.
- Loan rates, totals, and monthly payments ignore client-side calculations.
- `advance_passive_schedules(timestamptz)` is inaccessible to authenticated users.
- Direct inserts into flights, transactions, loans, reputations, and aircraft fail.
- Direct changes to company capital and protected aircraft fields fail.

## Release

Sign the Windows installer and executable with an Authenticode certificate. Publish a
SHA-256 checksum and only distribute signed updater manifests over HTTPS.
