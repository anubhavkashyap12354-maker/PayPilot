-- PayPilot Phase 2B Migration: PayPal Webhook Event Ledger & Idempotency
-- Creates an audit ledger to guarantee at-most-once processing of PayPal webhooks

-- 1. Create table for internal server-side webhook tracking
CREATE TABLE IF NOT EXISTS paypal_webhook_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    summary TEXT,
    status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 2. Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_event_id ON paypal_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_event_type ON paypal_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_resource_id ON paypal_webhook_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_received_at ON paypal_webhook_events(received_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE paypal_webhook_events ENABLE ROW LEVEL SECURITY;

-- 4. Strict Security: Block public/anonymous and authenticated access to the raw table
-- Webhook operations and raw payload inspection are strictly restricted to service_role (server-side only)
REVOKE ALL ON paypal_webhook_events FROM anon, authenticated;
GRANT ALL ON paypal_webhook_events TO service_role;

-- Ensure no policies permit anon or authenticated access on the raw table
DROP POLICY IF EXISTS "Allow anon read-only paypal_webhook_events" ON paypal_webhook_events;

-- 5. Safe Public Audit View (Exposes only non-sensitive metadata for dashboard telemetry)
-- Raw payloads, authorization tokens, and internal error stack traces are strictly excluded
CREATE OR REPLACE VIEW demo_webhook_audit_view AS
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

-- Grant read-only access on the sanitized view to public/anon
GRANT SELECT ON demo_webhook_audit_view TO anon, authenticated;

COMMENT ON TABLE paypal_webhook_events IS 'Idempotent server-side log of verified PayPal webhook deliveries';
COMMENT ON COLUMN paypal_webhook_events.event_id IS 'Unique PayPal webhook event identifier (e.g. WH-XXXXXXXXXX)';
COMMENT ON VIEW demo_webhook_audit_view IS 'Sanitized public view exposing non-sensitive webhook metadata without raw payloads';
