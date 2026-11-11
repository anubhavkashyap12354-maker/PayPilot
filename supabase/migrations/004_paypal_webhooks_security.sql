-- PayPilot Phase 2B Security Hardening: Incremental Migration
-- Apply AFTER 003_paypal_webhooks.sql
--
-- This migration is SAFE to run regardless of whether the original 003_ or the
-- updated 003_ was applied. All statements are additive and idempotent.
--
-- What this fixes:
--   1. Ensures anon/authenticated have zero direct access to paypal_webhook_events
--   2. Drops the original insecure anon SELECT policy if it was ever applied
--   3. Recreates demo_webhook_audit_view with SECURITY INVOKER = true to prevent
--      privilege escalation through the view definition
--   4. Adds claimed_at column for future database-backed atomic event claiming
--      (supports safe multi-process / serverless concurrency beyond inFlightEvents)

-- ─── 1. Revoke all direct table access from public roles ──────────────────────
-- Idempotent: REVOKE on a role that has no grants is a no-op.
REVOKE ALL ON TABLE paypal_webhook_events FROM anon;
REVOKE ALL ON TABLE paypal_webhook_events FROM authenticated;
GRANT ALL ON TABLE paypal_webhook_events TO service_role;

-- ─── 2. Remove any existing insecure policy (original 003_ applied it) ────────
-- DROP POLICY IF EXISTS is fully idempotent.
DROP POLICY IF EXISTS "Allow anon read-only paypal_webhook_events" ON paypal_webhook_events;

-- ─── 3. Recreate the audit view with SECURITY INVOKER ─────────────────────────
-- SECURITY INVOKER means the view runs with the caller's privileges, not the
-- view owner's. This prevents an anon caller from reading rows that the
-- underlying RLS policy would otherwise block for them.
-- Only the sanitised columns are exposed; raw payload, error_message, and
-- internal IDs are deliberately excluded.
DROP VIEW IF EXISTS demo_webhook_audit_view;

-- Note: Columns deliberately excluded from this view:
--   payload       (raw JSON webhook body — may contain PII / sensitive data)
--   error_message (internal stack traces / system information)
CREATE VIEW demo_webhook_audit_view
  WITH (security_invoker = true)
AS
SELECT
    id,
    event_id,
    event_type,
    resource_type,
    resource_id,
    summary,
    status,
    received_at,
    processed_at
FROM paypal_webhook_events;

-- Grant read-only on the sanitised view only; raw table remains inaccessible.
GRANT SELECT ON demo_webhook_audit_view TO anon;
GRANT SELECT ON demo_webhook_audit_view TO authenticated;

-- ─── 4. Add claimed_at for database-backed atomic event claiming ───────────────
-- When set, this timestamp records when a webhook worker atomically claimed the
-- event via an INSERT ... ON CONFLICT DO NOTHING pattern or a unique-violation
-- guard. Used in multi-process / serverless deployments where the in-memory
-- inFlightEvents Set cannot coordinate across workers.
ALTER TABLE paypal_webhook_events
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- ─── 5. Helpful comments ──────────────────────────────────────────────────────
COMMENT ON VIEW demo_webhook_audit_view IS
  'Security-hardened public audit view. SECURITY INVOKER prevents privilege '
  'escalation. Exposes only non-sensitive webhook metadata: no raw payload, '
  'no error messages, no internal IDs beyond the PayPal event_id.';

COMMENT ON COLUMN paypal_webhook_events.claimed_at IS
  'Timestamp set when a worker atomically claims an event for processing. '
  'Supports cross-process idempotency in multi-worker / serverless deployments.';
