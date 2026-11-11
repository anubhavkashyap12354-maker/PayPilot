-- PayPilot Phase 1 Database Schema
-- Supabase PostgreSQL Migration

-- 1. Businesses Table
CREATE TABLE IF NOT EXISTS demo_businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    status TEXT NOT NULL CHECK (status IN ('active', 'trial', 'restricted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS demo_orders (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demo_businesses(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    shipping_address TEXT,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL CHECK (status IN ('fulfilled', 'processing', 'pending', 'cancelled')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    tracking_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Payments Table
CREATE TABLE IF NOT EXISTS demo_payments (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES demo_businesses(id) ON DELETE CASCADE,
    order_id TEXT REFERENCES demo_orders(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL CHECK (status IN ('completed', 'pending', 'failed')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('paypal', 'card', 'bank_transfer', 'apple_pay')),
    gateway TEXT NOT NULL DEFAULT 'paypal_checkout',
    gateway_reference TEXT,
    fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    description TEXT,
    error_message TEXT,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_demo_orders_business_id ON demo_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_demo_orders_status ON demo_orders(status);
CREATE INDEX IF NOT EXISTS idx_demo_orders_created_at ON demo_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_payments_business_id ON demo_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_demo_payments_order_id ON demo_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_demo_payments_status ON demo_payments(status);
CREATE INDEX IF NOT EXISTS idx_demo_payments_initiated_at ON demo_payments(initiated_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE demo_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_payments ENABLE ROW LEVEL SECURITY;

-- Minimum read-only policies for anonymous client access to fictional demo data
-- Disallow any public INSERT, UPDATE, DELETE modifications
CREATE POLICY "Allow anon read-only demo_businesses"
    ON demo_businesses FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow anon read-only demo_orders"
    ON demo_orders FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow anon read-only demo_payments"
    ON demo_payments FOR SELECT
    TO anon
    USING (true);

-- Seed Fictional Demo Data
INSERT INTO demo_businesses (id, name, legal_name, currency, timezone, status)
VALUES ('biz_paypilot_demo_01', 'Apex Velocity Technologies Ltd', 'Apex Velocity Technologies Limited', 'USD', 'America/New_York', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO demo_orders (id, business_id, order_number, customer_name, customer_email, shipping_address, total_amount, currency, status, items, tracking_number, created_at)
VALUES
('ord_001', 'biz_paypilot_demo_01', 'ORD-7801', 'Eleanor Vance', 'eleanor.vance@hillcrest.io', '452 Hillcrest Boulevard, Suite 300, Boston, MA 02116', 349.00, 'USD', 'fulfilled', '[{"id":"item_01","productName":"SaaS Enterprise Seat (Monthly)","quantity":1,"unitPrice":349.00,"totalPrice":349.00}]'::jsonb, 'PP-TRK-9812401', '2026-11-06T17:10:00Z'),
('ord_002', 'biz_paypilot_demo_01', 'ORD-7800', 'Marcus Sterling', 'marcus.s@sterlingops.com', '1200 Wall Street, 14th Floor, New York, NY 10005', 1250.00, 'USD', 'fulfilled', '[{"id":"item_02","productName":"Cloud Infrastructure License (1 Year)","quantity":1,"unitPrice":1250.00,"totalPrice":1250.00}]'::jsonb, 'PP-TRK-9812400', '2026-11-06T15:35:00Z'),
('ord_003', 'biz_paypilot_demo_01', 'ORD-7799', 'Sophia Dubois', 's.dubois@luxatelier.fr', '18 Rue du Faubourg Saint-Honoré, 75008 Paris, France', 520.00, 'USD', 'pending', '[{"id":"item_03","productName":"E-Commerce Payment Connector","quantity":2,"unitPrice":260.00,"totalPrice":520.00}]'::jsonb, NULL, '2026-11-06T14:05:00Z'),
('ord_004', 'biz_paypilot_demo_01', 'ORD-7798', 'David K. Alvarez', 'alvarez.d@solardelta.org', '770 Innovation Way, Austin, TX 78701', 890.00, 'USD', 'processing', '[{"id":"item_04","productName":"Edge Gateway Hardware Node","quantity":1,"unitPrice":890.00,"totalPrice":890.00}]'::jsonb, 'PP-TRK-9812398', '2026-11-06T12:20:00Z'),
('ord_005', 'biz_paypilot_demo_01', 'ORD-7797', 'Chen Wei', 'wei.chen@quantumreach.sg', '1 Raffles Place, #28-00, Singapore 048616', 145.00, 'USD', 'cancelled', '[{"id":"item_05","productName":"Developer API Add-on","quantity":1,"unitPrice":145.00,"totalPrice":145.00}]'::jsonb, NULL, '2026-11-06T11:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO demo_payments (id, business_id, order_id, amount, currency, status, payment_method, gateway, gateway_reference, fee, net_amount, customer_name, customer_email, description, initiated_at, settled_at)
VALUES
('pay_01', 'biz_paypilot_demo_01', 'ord_001', 349.00, 'USD', 'completed', 'paypal', 'paypal_checkout', 'PAYID-NPY6210091', 10.42, 338.58, 'Eleanor Vance', 'eleanor.vance@hillcrest.io', 'SaaS Enterprise Tier - Monthly Subscription', '2026-11-06T17:14:22Z', '2026-11-06T17:15:00Z'),
('pay_02', 'biz_paypilot_demo_01', 'ord_002', 1250.00, 'USD', 'completed', 'card', 'card_processor', 'CH_3Nx80921Bv', 36.55, 1213.45, 'Marcus Sterling', 'marcus.s@sterlingops.com', 'Annual Cloud Infrastructure License', '2026-11-06T15:41:40Z', '2026-11-06T15:42:00Z'),
('pay_03', 'biz_paypilot_demo_01', 'ord_003', 520.00, 'USD', 'pending', 'paypal', 'paypal_checkout', 'PAYID-NPY6209844', 15.38, 504.62, 'Sophia Dubois', 's.dubois@luxatelier.fr', 'E-Commerce Integration Suite', '2026-11-06T14:10:00Z', NULL)
ON CONFLICT (id) DO NOTHING;
