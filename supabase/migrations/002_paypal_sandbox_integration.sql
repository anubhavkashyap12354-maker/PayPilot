-- PayPilot Phase 2A Migration: PayPal Sandbox Integration
-- Preserves existing demo data while adding tracking columns for PayPal Orders v2 API

-- 1. Extend demo_orders table
ALTER TABLE demo_orders
ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Extend demo_payments table
ALTER TABLE demo_payments
ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Add Indexes for PayPal Order lookups
CREATE INDEX IF NOT EXISTS idx_demo_orders_paypal_order_id ON demo_orders(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_demo_payments_paypal_order_id ON demo_payments(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_demo_payments_paypal_capture_id ON demo_payments(paypal_capture_id);

-- 4. Maintain RLS (Read-only for public/anon; write permissions reserved strictly for server-side service role)
-- Anonymous users can continue to read orders and payments in demo mode
COMMENT ON COLUMN demo_orders.paypal_order_id IS 'PayPal Orders v2 generated Order ID (e.g. 5O190127TN364715T)';
COMMENT ON COLUMN demo_orders.paypal_capture_id IS 'Authoritative PayPal Capture transaction ID returned upon capture';
