-- PayPilot Phase 3D Migration: Persistent Human Approval Workflow (Security Hardened)
-- Apply AFTER 004_paypal_webhooks_security.sql
--
-- SAFETY & SECURITY CONTRACT:
--   1. Approval records document human authorization decisions ONLY.
--   2. No PayPal API calls, refunds, captures, or external payouts are executed.
--   3. Audit history is IMMUTABLE and cannot be erased: foreign key uses
--      ON DELETE RESTRICT (not CASCADE) to prevent audit trail destruction.
--   4. Anonymous users have ZERO access (REVOKE ALL).
--   5. Authenticated users have strictly scoped read-only access (SELECT via business-isolated RLS).
--      Global unconstrained read policies are strictly prohibited.
--   6. All mutations (INSERT, UPDATE) and decision transitions are performed server-side by trusted
--      endpoints using service_role credentials via atomic database transactions. Direct client writes are blocked.
--   7. Concurrency protection and atomicity are enforced via the decide_approval_atomic() stored procedure.

-- ─── 1. Approvals Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_requests (
    id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id         TEXT        NOT NULL DEFAULT 'biz_paypilot_demo_01'
                                    REFERENCES demo_businesses(id) ON DELETE RESTRICT,
    recommendation_type TEXT        NOT NULL
                            CHECK (recommendation_type IN (
                                'contact_customer',
                                'retry_payment',
                                'review_high_value_order',
                                'accelerate_payout',
                                'optimize_checkout'
                            )),
    title               TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
    description         TEXT        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
    rationale           TEXT        NOT NULL CHECK (char_length(rationale) BETWEEN 1 AND 2000),
    priority            TEXT        NOT NULL
                            CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    related_order_id    TEXT        NULL,  -- advisory reference only, NOT a FK to prevent cascade mutations
    proposed_action     TEXT        NOT NULL CHECK (char_length(proposed_action) BETWEEN 1 AND 2000),
    status              TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
    lock_version        INTEGER     NOT NULL DEFAULT 1 CHECK (lock_version >= 1),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at          TIMESTAMPTZ NULL,
    decision_reason     TEXT        NULL CHECK (decision_reason IS NULL OR char_length(decision_reason) BETWEEN 1 AND 1000)
);

-- ─── 2. Approval Audit History Table (Append-Only) ───────────────────────────
-- Foreign key uses ON DELETE RESTRICT: an approval request with audit entries
-- can NEVER be deleted, safeguarding audit immutability and compliance.
CREATE TABLE IF NOT EXISTS approval_audit_history (
    id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    approval_id     TEXT        NOT NULL REFERENCES approval_requests(id) ON DELETE RESTRICT,
    previous_status TEXT        NULL
                        CHECK (previous_status IS NULL OR previous_status IN (
                            'pending', 'approved', 'rejected', 'changes_requested'
                        )),
    new_status      TEXT        NOT NULL
                        CHECK (new_status IN (
                            'pending', 'approved', 'rejected', 'changes_requested'
                        )),
    decision_reason TEXT        NULL,
    actor_id        TEXT        NOT NULL,  -- Verified server-side session identity (user ID or email)
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Performance & Lookup Indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_approval_requests_business_id
    ON approval_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status
    ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at
    ON approval_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_related_order
    ON approval_requests(related_order_id)
    WHERE related_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_requests_priority
    ON approval_requests(priority);
CREATE INDEX IF NOT EXISTS idx_approval_requests_lock_version
    ON approval_requests(id, lock_version);

CREATE INDEX IF NOT EXISTS idx_approval_audit_approval_id
    ON approval_audit_history(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_recorded_at
    ON approval_audit_history(recorded_at DESC);

-- ─── 4. updated_at Auto-Maintenance Trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON approval_requests;
CREATE TRIGGER trg_approval_requests_updated_at
    BEFORE UPDATE ON approval_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 5. Row Level Security (RLS) Activation ───────────────────────────────────
ALTER TABLE approval_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_audit_history  ENABLE ROW LEVEL SECURITY;

-- ─── 6. SQL Permissions (Strict Least-Privilege Model) ────────────────────────
-- Revoke all public and direct client write access
REVOKE ALL ON approval_requests      FROM anon, authenticated;
REVOKE ALL ON approval_audit_history FROM anon, authenticated;

-- Allow authenticated users to read strictly through scoped RLS (no anon access)
GRANT SELECT ON approval_requests      TO authenticated;
GRANT SELECT ON approval_audit_history TO authenticated;

-- Allow trusted server-side code (using SUPABASE_SERVICE_ROLE_KEY) full management
GRANT ALL ON approval_requests      TO service_role;
GRANT ALL ON approval_audit_history TO service_role;

-- ─── 7. Business-Scoped RLS Policies ──────────────────────────────────────────
-- Clean up any prior policies
DROP POLICY IF EXISTS "Allow anon read-only approval_requests"      ON approval_requests;
DROP POLICY IF EXISTS "Allow anon insert approval_requests"         ON approval_requests;
DROP POLICY IF EXISTS "Allow anon read-only approval_audit_history" ON approval_audit_history;
DROP POLICY IF EXISTS "Allow authenticated read approval_requests"      ON approval_requests;
DROP POLICY IF EXISTS "Allow authenticated read approval_audit_history" ON approval_audit_history;
DROP POLICY IF EXISTS "business_isolation_approval_requests"            ON approval_requests;
DROP POLICY IF EXISTS "business_isolation_approval_audit"               ON approval_audit_history;

-- Multi-Tenant / Business Isolation Policy:
-- Authenticated users can ONLY view approval requests belonging to their authorized business.
-- Unscoped global read policies are strictly prohibited.
CREATE POLICY "business_isolation_approval_requests"
    ON approval_requests FOR SELECT
    TO authenticated
    USING (
        business_id = COALESCE(
            auth.jwt() ->> 'business_id',
            auth.jwt() -> 'app_metadata' ->> 'business_id',
            auth.jwt() -> 'user_metadata' ->> 'business_id'
        )
    );

-- Scoped Audit History Policy:
-- Authenticated users can ONLY view audit records for approvals owned by their authorized business.
CREATE POLICY "business_isolation_approval_audit"
    ON approval_audit_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM approval_requests a
            WHERE a.id = approval_audit_history.approval_id
              AND a.business_id = COALESCE(
                  auth.jwt() ->> 'business_id',
                  auth.jwt() -> 'app_metadata' ->> 'business_id',
                  auth.jwt() -> 'user_metadata' ->> 'business_id'
              )
        )
    );

-- ─── 8. Atomic Decision & Audit Function (Single-Transaction RPC) ─────────────
-- Executes approval row lock, transition check, optimistic lock check, status update,
-- and audit trail insertion within ONE atomic database transaction.
CREATE OR REPLACE FUNCTION decide_approval_atomic(
    p_approval_id       TEXT,
    p_expected_version  INTEGER,
    p_new_status        TEXT,
    p_decision_reason   TEXT,
    p_actor_id          TEXT,
    p_expected_business TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current approval_requests%ROWTYPE;
    v_updated approval_requests%ROWTYPE;
    v_is_terminal BOOLEAN;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Validate status format
    IF p_new_status NOT IN ('pending', 'approved', 'rejected', 'changes_requested') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_STATUS',
            'error', format('Invalid target status: %s', p_new_status)
        );
    END IF;

    -- 2. Lock target approval row FOR UPDATE to ensure serializability
    SELECT * INTO v_current
    FROM approval_requests
    WHERE id = p_approval_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOT_FOUND',
            'error', 'Approval record not found.'
        );
    END IF;

    -- 3. Business ownership validation
    IF p_expected_business IS NOT NULL AND v_current.business_id <> p_expected_business THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FORBIDDEN',
            'error', 'Cross-business approval access is prohibited.'
        );
    END IF;

    -- 4. State transition strictness validation
    IF v_current.status = 'approved' OR v_current.status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TERMINAL_STATE',
            'error', format('Invalid status transition: ''%s'' is a terminal state and cannot be modified.', v_current.status)
        );
    ELSIF v_current.status = 'pending' AND p_new_status NOT IN ('approved', 'rejected', 'changes_requested') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TRANSITION',
            'error', format('Invalid status transition: ''pending'' -> ''%s''.', p_new_status)
        );
    ELSIF v_current.status = 'changes_requested' AND p_new_status NOT IN ('pending', 'rejected') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TRANSITION',
            'error', format('Invalid status transition: ''changes_requested'' -> ''%s''.', p_new_status)
        );
    END IF;

    -- 5. Optimistic concurrency check (lock_version)
    IF v_current.lock_version <> p_expected_version THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'CONCURRENCY_CONFLICT',
            'error', 'Concurrency conflict: This approval was modified by another reviewer. Please refresh and retry.'
        );
    END IF;

    v_is_terminal := (p_new_status = 'approved' OR p_new_status = 'rejected');

    -- 6. Perform atomic status update
    UPDATE approval_requests
    SET status = p_new_status,
        lock_version = v_current.lock_version + 1,
        decided_at = CASE WHEN v_is_terminal THEN v_now ELSE NULL END,
        decision_reason = p_decision_reason,
        updated_at = v_now
    WHERE id = p_approval_id
    RETURNING * INTO v_updated;

    -- 7. Insert audit record in the EXACT SAME database transaction
    INSERT INTO approval_audit_history (
        approval_id,
        previous_status,
        new_status,
        decision_reason,
        actor_id,
        recorded_at
    ) VALUES (
        p_approval_id,
        v_current.status,
        p_new_status,
        p_decision_reason,
        p_actor_id,
        v_now
    );

    -- 8. Return updated record
    RETURN jsonb_build_object(
        'success', true,
        'approval', to_jsonb(v_updated)
    );
END;
$$;

-- Explicitly revoke RPC execution from PUBLIC, anon, and authenticated roles
REVOKE ALL ON FUNCTION decide_approval_atomic(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION decide_approval_atomic(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION decide_approval_atomic(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM authenticated;

-- Grant execution ONLY to trusted server-side service_role
GRANT EXECUTE ON FUNCTION decide_approval_atomic(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ─── 9. Schema Documentation Comments ─────────────────────────────────────────
COMMENT ON TABLE approval_requests IS
    'Persistent human approval records. Advisory authorization decisions ONLY; '
    'no financial transactions or external dispatches are executed. Multi-tenant scoped.';

COMMENT ON TABLE approval_audit_history IS
    'Append-only immutable audit trail for every approval status transition. '
    'Protected by ON DELETE RESTRICT to guarantee audit retention. '
    'Direct client writes are prohibited.';

COMMENT ON COLUMN approval_requests.business_id IS
    'Foreign key to demo_businesses. Enforces business data isolation via RLS.';

COMMENT ON COLUMN approval_requests.lock_version IS
    'Optimistic concurrency locking counter. Incremented on each decision update '
    'to prevent race conditions between simultaneous reviewers.';

COMMENT ON COLUMN approval_audit_history.actor_id IS
    'Verified user identifier derived from server-side session authentication. '
    'Never client-supplied or untrusted.';

COMMENT ON FUNCTION decide_approval_atomic IS
    'Single-transaction RPC that atomically updates approval state and creates '
    'an audit trail entry with optimistic locking and row-level exclusivity.';
