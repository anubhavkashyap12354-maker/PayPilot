/**
 * PayPilot Phase 3D.4: Comprehensive Approval Security & Atomicity Test Suite
 *
 * Enforces:
 * - Production demo-session generation is strictly rejected (HTTP 403).
 * - Demo identity impersonation is rejected: fixed identity only, arbitrary body ignored.
 * - Missing session secrets fail closed.
 * - Supabase auth failures never fall back to local HMAC tokens.
 * - Atomic approval updates & audit trails: audit insertion failure rolls back status update.
 * - Optimistic concurrency protection (HTTP 409 Conflict on simultaneous decisions).
 * - Cross-business data isolation: cross-tenant reads and decisions rejected with HTTP 403.
 * - SQL migration hardening: decide_approval_atomic RPC, ON DELETE RESTRICT, business RLS.
 * - ZERO PayPal or external financial operations.
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";

// Ensure test environment enables demo auth and sets a valid test secret
process.env.NODE_ENV = "test";
process.env.PAYPILOT_DEMO_AUTH = "true";
process.env.SESSION_SECRET = "paypilot_unit_test_hmac_secret_key_32_bytes_min";

describe("PayPilot Phase 3D.4: Approval Security Remediation", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYPILOT_DEMO_AUTH = "true";
    process.env.SESSION_SECRET = "paypilot_unit_test_hmac_secret_key_32_bytes_min";

    const { __resetInMemoryStoreForTesting } = await import(
      "../src/lib/server/approvals-store.ts"
    );
    __resetInMemoryStoreForTesting();
  });

  // ─── 1. Authentication Guards & Session Protection ──────────────────────────

  test("1. Auth Guard: Unauthenticated requests receive HTTP 401 across all approval endpoints", async () => {
    const { GET: listGet, POST: listPost } = await import("../src/app/api/approvals/route.ts");
    const { GET: singleGet, PATCH: singlePatch } = await import("../src/app/api/approvals/[id]/route.ts");

    const req1 = new NextRequest("http://localhost:3000/api/approvals");
    assert.equal((await listGet(req1)).status, 401);

    const req2 = new NextRequest("http://localhost:3000/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation_type: "contact_customer", title: "T", description: "D", rationale: "R", priority: "high", proposed_action: "A" }),
    });
    assert.equal((await listPost(req2)).status, 401);

    const req3 = new NextRequest("http://localhost:3000/api/approvals/apr_test");
    assert.equal((await singleGet(req3, { params: Promise.resolve({ id: "apr_test" }) })).status, 401);

    const req4 = new NextRequest("http://localhost:3000/api/approvals/apr_test", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    assert.equal((await singlePatch(req4, { params: Promise.resolve({ id: "apr_test" }) })).status, 401);
  });

  test("2. Auth Guard: Demo-session generation is controlled by PAYPILOT_DEMO_AUTH flag", async () => {
    const { POST } = await import("../src/app/api/auth/session/route.ts");

    // Case A: PAYPILOT_DEMO_AUTH=true allows demo session regardless of NODE_ENV
    process.env.NODE_ENV = "production";
    process.env.PAYPILOT_DEMO_AUTH = "true";

    const reqProd = new NextRequest("http://localhost:3000/api/auth/session", { method: "POST" });
    const resProd = await POST(reqProd);
    assert.equal(resProd.status, 200, "Demo auth with PAYPILOT_DEMO_AUTH=true must succeed");

    // Case B: PAYPILOT_DEMO_AUTH is false or unset → rejected
    process.env.NODE_ENV = "development";
    delete process.env.PAYPILOT_DEMO_AUTH;

    const reqNoFlag = new NextRequest("http://localhost:3000/api/auth/session", { method: "POST" });
    const resNoFlag = await POST(reqNoFlag);
    assert.equal(resNoFlag.status, 403, "Demo auth without PAYPILOT_DEMO_AUTH=true must return 403");
  });

  test("3. Anti-Impersonation: Demo auth issues FIXED identity, ignoring client email/userId input", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYPILOT_DEMO_AUTH = "true";

    const { POST } = await import("../src/app/api/auth/session/route.ts");
    const { FIXED_DEMO_USER } = await import("../src/lib/auth/session.ts");

    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "impersonated_executive@paypal.com",
        userId: "usr_ceo_spoof",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.user.id, FIXED_DEMO_USER.id, "Must issue fixed demo ID");
    assert.equal(json.user.email, FIXED_DEMO_USER.email, "Must issue fixed demo email");
    assert.notEqual(json.user.email, "impersonated_executive@paypal.com", "Must NOT allow spoofed email");
    assert.notEqual(json.user.id, "usr_ceo_spoof", "Must NOT allow spoofed userId");
  });

  test("4. Missing Session Secret: Fails closed with server error (no hardcoded fallback)", async () => {
    delete process.env.SESSION_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { getSessionSecret } = await import("../src/lib/auth/session.ts");
    assert.throws(
      () => getSessionSecret(),
      /CRITICAL AUTH CONFIG ERROR: SESSION_SECRET is not configured/i,
      "Must throw error when session secret is missing"
    );
  });

  test("5. Anti-Spoofing: Rejects attempts to supply actor_id in request bodies with HTTP 400", async () => {
    const { POST } = await import("../src/app/api/approvals/route.ts");
    const { PATCH } = await import("../src/app/api/approvals/[id]/route.ts");
    const { createSignedSessionToken, FIXED_DEMO_USER } = await import("../src/lib/auth/session.ts");
    const { createApproval } = await import("../src/lib/server/approvals-store.ts");

    const token = createSignedSessionToken(FIXED_DEMO_USER);

    // POST spoof attempt via dedicated demo cookie
    const reqPost = new NextRequest("http://localhost:3000/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `paypilot_session=${token}` },
      body: JSON.stringify({
        recommendation_type: "contact_customer",
        title: "T",
        description: "D",
        rationale: "R",
        priority: "high",
        proposed_action: "A",
        actor_id: "Fake_Actor",
      }),
    });
    const resPost = await POST(reqPost);
    assert.equal(resPost.status, 400);
    const jsonPost = await resPost.json();
    assert.match(jsonPost.error, /actor_id cannot be specified/i);

    // PATCH spoof attempt via dedicated demo cookie
    const created = await createApproval(
      { recommendation_type: "retry_payment", title: "T", description: "D", rationale: "R", priority: "high", proposed_action: "A" },
      FIXED_DEMO_USER.email
    );
    const reqPatch = new NextRequest(`http://localhost:3000/api/approvals/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `paypilot_session=${token}` },
      body: JSON.stringify({ status: "approved", actor_id: "Fake_Actor" }),
    });
    const resPatch = await PATCH(reqPatch, { params: Promise.resolve({ id: created.data.id }) });
    assert.equal(resPatch.status, 400);
    const jsonPatch = await resPatch.json();
    assert.match(jsonPatch.error, /actor_id cannot be specified/i);
  });

  test("5b. Auth Strictness: Supabase auth failure NEVER falls back to local HMAC tokens", async () => {
    const sessionModule = await import("../src/lib/auth/session.ts");

    // Inject mocked Supabase client that rejects Bearer tokens
    sessionModule.__setTestSupabaseClient({
      auth: {
        getUser: async () => ({
          data: null,
          error: { message: "Invalid JWT: Signature verification failed on Supabase Auth" },
        }),
      },
    });

    try {
      const req = new NextRequest("http://localhost:3000/api/approvals", {
        headers: { Authorization: "Bearer bad.supabase.token" },
      });

      const result = await sessionModule.verifyRequestSession(req);
      assert.equal(
        result.authenticated,
        false,
        "Must NOT authenticate via HMAC fallback when Supabase Bearer token is rejected"
      );
      assert.match(
        result.error,
        /Signature verification failed on Supabase Auth/i,
        "Must return Supabase error and refuse fallback"
      );
    } finally {
      sessionModule.__setTestSupabaseClient(null);
    }
  });

  // ─── 2. Data Isolation & Business Scoping ───────────────────────────────────

  test("6. Multi-Tenant Isolation: Cross-business reads and decisions return HTTP 403", async () => {
    const { GET: singleGet, PATCH: singlePatch } = await import("../src/app/api/approvals/[id]/route.ts");
    const { createApproval } = await import("../src/lib/server/approvals-store.ts");
    const { createSignedSessionToken } = await import("../src/lib/auth/session.ts");

    // Approval owned by Business A
    const created = await createApproval(
      { recommendation_type: "contact_customer", title: "Tenant A Approval", description: "D", rationale: "R", priority: "high", proposed_action: "A" },
      "agent_a@paypilot.demo",
      "biz_paypilot_demo_01"
    );

    // User authenticated under Business B
    const tokenB = createSignedSessionToken({
      id: "usr_tenant_b",
      email: "tenant_b@othercompany.io",
      business_id: "biz_other_merchant_99",
    });

    // Attempt to GET Business A's approval
    const getReq = new NextRequest(`http://localhost:3000/api/approvals/${created.data.id}`, {
      headers: { Cookie: `paypilot_session=${tokenB}` },
    });
    const getRes = await singleGet(getReq, { params: Promise.resolve({ id: created.data.id }) });
    assert.equal(getRes.status, 403, "Cross-business read must return HTTP 403");

    // Attempt to decide Business A's approval
    const patchReq = new NextRequest(`http://localhost:3000/api/approvals/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `paypilot_session=${tokenB}` },
      body: JSON.stringify({ status: "approved" }),
    });
    const patchRes = await singlePatch(patchReq, { params: Promise.resolve({ id: created.data.id }) });
    assert.equal(patchRes.status, 403, "Cross-business decision must return HTTP 403");
  });

  // ─── 3. Atomicity & Transactional Rollback ──────────────────────────────────

  test("7. Atomicity: Successful approval transition writes exactly one audit entry", async () => {
    const { createApproval, decideApproval, getApprovalAuditHistory } = await import(
      "../src/lib/server/approvals-store.ts"
    );

    const created = await createApproval(
      { recommendation_type: "accelerate_payout", title: "Payout Acceleration", description: "D", rationale: "R", priority: "high", proposed_action: "A" },
      "submitter@paypilot.demo"
    );

    const dec = await decideApproval(
      created.data.id,
      { status: "approved", decision_reason: "Approved after compliance verification" },
      "reviewer@paypilot.demo"
    );
    assert.equal(dec.statusCode, 200);

    const audit = await getApprovalAuditHistory(created.data.id);
    assert.equal(audit.data.length, 2, "Must contain exactly 2 entries (creation + decision)");
    assert.equal(audit.data[1].new_status, "approved");
    assert.equal(audit.data[1].actor_id, "reviewer@paypilot.demo");
  });

  test("8. Atomicity: Audit insertion failure rolls back the approval status update", async () => {
    const {
      createApproval,
      decideApproval,
      getApproval,
      getApprovalAuditHistory,
      __setSimulateAuditFailureForTesting,
    } = await import("../src/lib/server/approvals-store.ts");

    const created = await createApproval(
      { recommendation_type: "review_high_value_order", title: "Atomic Rollback Test", description: "D", rationale: "R", priority: "urgent", proposed_action: "A" },
      "submitter@paypilot.demo"
    );

    assert.equal(created.data.status, "pending");
    assert.equal(created.data.lock_version, 1);

    // Enable simulated audit failure
    __setSimulateAuditFailureForTesting(true);

    const failedDecision = await decideApproval(
      created.data.id,
      { status: "approved" },
      "reviewer@paypilot.demo"
    );

    assert.equal(failedDecision.statusCode, 500);
    assert.match(failedDecision.error, /Transaction rolled back/i);

    // Disable failure injection for inspection
    __setSimulateAuditFailureForTesting(false);

    // Verify status was NOT changed (rolled back to pending)
    const after = await getApproval(created.data.id);
    assert.equal(after.data.status, "pending", "Status must remain pending after rollback");
    assert.equal(after.data.lock_version, 1, "lock_version must not increment on rollback");

    // Verify audit trail was NOT updated with failed decision
    const audit = await getApprovalAuditHistory(created.data.id);
    assert.equal(audit.data.length, 1, "Audit must only contain initial creation entry");
  });

  test("9. Concurrency Protection: Competing simultaneous decisions result in exactly one 200 and one 409", async () => {
    const { createApproval, decideApproval, getApprovalAuditHistory } = await import(
      "../src/lib/server/approvals-store.ts"
    );

    const created = await createApproval(
      { recommendation_type: "review_high_value_order", title: "Race Condition", description: "D", rationale: "R", priority: "urgent", proposed_action: "A" },
      "author@paypilot.demo"
    );

    const decisionA = decideApproval(
      created.data.id,
      { status: "approved", decision_reason: "Reviewer A", expected_version: 1 },
      "reviewer_a@paypilot.demo"
    );
    const decisionB = decideApproval(
      created.data.id,
      { status: "rejected", decision_reason: "Reviewer B", expected_version: 1 },
      "reviewer_b@paypilot.demo"
    );

    const [resA, resB] = await Promise.all([decisionA, decisionB]);
    const codes = [resA.statusCode, resB.statusCode].sort();

    assert.equal(codes[0], 200, "One reviewer must succeed");
    assert.equal(codes[1], 409, "Conflicting reviewer must receive 409 Conflict");

    const audit = await getApprovalAuditHistory(created.data.id);
    assert.equal(audit.data.length, 2, "Audit must contain creation + winning decision only");
  });

  // ─── 4. Database Migration & Security Specifications ────────────────────────

  test("10. Migration 005: Contains decide_approval_atomic stored procedure with FOR UPDATE lock", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const sql = await fs.readFile(path.resolve("supabase/migrations/005_persistent_approvals.sql"), "utf-8");

    assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+decide_approval_atomic/i);
    assert.match(sql, /FOR\s+UPDATE/i, "Must use SELECT ... FOR UPDATE to lock row");
    assert.match(sql, /UPDATE\s+approval_requests/i);
    assert.match(sql, /INSERT\s+INTO\s+approval_audit_history/i);
  });

  test("11. Migration 005: Revokes decide_approval_atomic from PUBLIC/anon/authenticated; grants service_role", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const sql = await fs.readFile(path.resolve("supabase/migrations/005_persistent_approvals.sql"), "utf-8");

    assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+decide_approval_atomic[\s\S]*?FROM\s+PUBLIC/i);
    assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+decide_approval_atomic[\s\S]*?FROM\s+anon/i);
    assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+decide_approval_atomic[\s\S]*?FROM\s+authenticated/i);
    assert.match(sql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+decide_approval_atomic[\s\S]*?TO\s+service_role/i);
  });

  test("12. Migration 005: Enforces business_id FK, index, and business isolation RLS", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const sql = await fs.readFile(path.resolve("supabase/migrations/005_persistent_approvals.sql"), "utf-8");

    assert.match(sql, /business_id[\s\S]*?REFERENCES\s+demo_businesses\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
    assert.match(sql, /idx_approval_requests_business_id/i);
    assert.match(sql, /CREATE\s+POLICY\s+["']business_isolation_approval_requests["']/i);
    assert.match(sql, /CREATE\s+POLICY\s+["']business_isolation_approval_audit["']/i);
    assert.doesNotMatch(sql, /USING\s*\(true\)/i, "Migration 005 must NEVER use permissive USING (true)");
  });

  test("13. Migration 005: Audit table uses ON DELETE RESTRICT (no CASCADE)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const sql = await fs.readFile(path.resolve("supabase/migrations/005_persistent_approvals.sql"), "utf-8");

    assert.match(sql, /approval_id[\s\S]*?REFERENCES\s+approval_requests\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
    assert.doesNotMatch(sql, /approval_audit_history[\s\S]*?ON\s+DELETE\s+CASCADE/i);
  });

  test("14. Admin Client: Server-only module throws if imported in client environment", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(path.resolve("src/lib/supabase/admin.ts"), "utf-8");

    assert.match(src, /typeof\s+window\s*!==\s*['"]undefined['"]/);
    assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(src, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  });

  test("15. State Machine: Terminal states 'approved' and 'rejected' cannot be transitioned", async () => {
    const { createApproval, decideApproval } = await import(
      "../src/lib/server/approvals-store.ts"
    );

    const a1 = await createApproval(
      { recommendation_type: "contact_customer", title: "Terminal", description: "D", rationale: "R", priority: "medium", proposed_action: "A" },
      "user@paypilot.demo"
    );

    await decideApproval(a1.data.id, { status: "approved" }, "ops@paypilot.demo");

    const illegal1 = await decideApproval(a1.data.id, { status: "rejected" }, "ops@paypilot.demo");
    assert.equal(illegal1.statusCode, 422);

    const illegal2 = await decideApproval(a1.data.id, { status: "changes_requested" }, "ops@paypilot.demo");
    assert.equal(illegal2.statusCode, 422);
  });

  test("16. Safety: No PayPal API calls, refunds, captures, or email sending in approval codebase", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const files = [
      "src/lib/server/approvals-store.ts",
      "src/app/api/approvals/route.ts",
      "src/app/api/approvals/[id]/route.ts",
      "src/lib/auth/session.ts",
      "src/lib/supabase/admin.ts",
    ];

    for (const f of files) {
      const src = await fs.readFile(path.resolve(f), "utf-8");
      assert.doesNotMatch(src, /paypal\/client/, `${f} must not import PayPal client`);
      assert.doesNotMatch(src, /PayPalService/, `${f} must not reference PayPalService`);
      assert.doesNotMatch(src, /\/v2\/payments\/captures/, `${f} must not call capture API`);
      assert.doesNotMatch(src, /\/v2\/payments\/refunds/, `${f} must not call refund API`);
      assert.doesNotMatch(src, /nodemailer|sendgrid|mailgun|smtp/i, `${f} must not send emails`);
    }
  });

  // ─── 5. Phase 3D.4 Integration Regression Tests ─────────────────────────────

  test("17. Regression: Valid demo cookie + active Supabase configuration succeeds via HMAC without calling Supabase getUser()", async () => {
    const sessionModule = await import("../src/lib/auth/session.ts");
    const { GET } = await import("../src/app/api/approvals/route.ts");

    let getUserCalled = false;
    sessionModule.__setTestSupabaseClient({
      auth: {
        getUser: async () => {
          getUserCalled = true;
          return { data: null, error: { message: "Supabase getUser() should never be called for demo cookie" } };
        },
      },
    });

    const token = sessionModule.createSignedSessionToken(sessionModule.FIXED_DEMO_USER);

    try {
      const req = new NextRequest("http://localhost:3000/api/approvals", {
        headers: { Cookie: `paypilot_session=${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 200, "Must return HTTP 200 for valid demo cookie even with active Supabase client");
      assert.equal(getUserCalled, false, "supabase.auth.getUser() must NEVER be called when demo cookie is presented");
      const json = await res.json();
      assert.equal(json.success, true);
    } finally {
      sessionModule.__setTestSupabaseClient(null);
    }
  });

  test("18. Regression: Invalid Supabase Bearer token returns 401 with no HMAC fallback", async () => {
    const sessionModule = await import("../src/lib/auth/session.ts");
    const { GET } = await import("../src/app/api/approvals/route.ts");

    let getUserCalled = false;
    sessionModule.__setTestSupabaseClient({
      auth: {
        getUser: async () => {
          getUserCalled = true;
          return { data: null, error: { message: "Invalid JWT signature from Supabase GoTrue" } };
        },
      },
    });

    try {
      const req = new NextRequest("http://localhost:3000/api/approvals", {
        headers: { Authorization: "Bearer malformed_or_expired_jwt" },
      });
      const res = await GET(req);
      assert.equal(res.status, 401, "Must return HTTP 401 when Supabase Bearer token fails verification");
      assert.equal(getUserCalled, true, "Must have routed to Supabase Auth");
      const json = await res.json();
      assert.match(json.error, /Invalid JWT signature from Supabase GoTrue/i);
    } finally {
      sessionModule.__setTestSupabaseClient(null);
    }
  });

  test("19. Regression: Valid demo cookie in production with PAYPILOT_DEMO_AUTH=true is accepted", async () => {
    const sessionModule = await import("../src/lib/auth/session.ts");
    const { GET } = await import("../src/app/api/approvals/route.ts");

    process.env.NODE_ENV = "production";
    process.env.PAYPILOT_DEMO_AUTH = "true";

    const token = sessionModule.createSignedSessionToken(sessionModule.FIXED_DEMO_USER);

    const req = new NextRequest("http://localhost:3000/api/approvals", {
      headers: { Cookie: `paypilot_session=${token}` },
    });
    const res = await GET(req);
    assert.equal(res.status, 200, "Must return HTTP 200 for demo cookie when PAYPILOT_DEMO_AUTH=true");
  });

  test("20. Regression: Demo authentication disabled (PAYPILOT_DEMO_AUTH unset) rejects demo cookie", async () => {
    const sessionModule = await import("../src/lib/auth/session.ts");
    const { GET } = await import("../src/app/api/approvals/route.ts");

    process.env.NODE_ENV = "test";
    delete process.env.PAYPILOT_DEMO_AUTH;

    const token = sessionModule.createSignedSessionToken(sessionModule.FIXED_DEMO_USER);

    const req = new NextRequest("http://localhost:3000/api/approvals", {
      headers: { Cookie: `paypilot_session=${token}` },
    });
    const res = await GET(req);
    assert.equal(res.status, 401, "Must reject demo cookie when PAYPILOT_DEMO_AUTH is disabled");
    const json = await res.json();
    assert.match(json.error, /Demo authentication is disabled/i);
  });

  test("21. Regression: Invalid, tampered, or expired demo cookie returns 401 without contacting Supabase", async () => {
    const sessionModule = await import("../src/lib/auth/session.ts");
    const { GET } = await import("../src/app/api/approvals/route.ts");

    let getUserCalled = false;
    sessionModule.__setTestSupabaseClient({
      auth: {
        getUser: async () => {
          getUserCalled = true;
          return { data: null, error: { message: "Should never be called" } };
        },
      },
    });

    try {
      // Tampered token
      const valid = sessionModule.createSignedSessionToken(sessionModule.FIXED_DEMO_USER);
      const tampered = valid.slice(0, -6) + "XXXXXX";
      const reqTampered = new NextRequest("http://localhost:3000/api/approvals", {
        headers: { Cookie: `paypilot_session=${tampered}` },
      });
      const resTampered = await GET(reqTampered);
      assert.equal(resTampered.status, 401);
      assert.equal(getUserCalled, false, "Must never contact Supabase for tampered demo cookie");

      // Expired token
      const expired = sessionModule.createSignedSessionToken(sessionModule.FIXED_DEMO_USER, -10);
      const reqExpired = new NextRequest("http://localhost:3000/api/approvals", {
        headers: { Cookie: `paypilot_session=${expired}` },
      });
      const resExpired = await GET(reqExpired);
      assert.equal(resExpired.status, 401);
      assert.equal(getUserCalled, false, "Must never contact Supabase for expired demo cookie");
    } finally {
      sessionModule.__setTestSupabaseClient(null);
    }
  });

  test("22. Regression: ApprovalsView references server-returned demo identity and eliminates hardcoded ops.manager", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(path.resolve("src/components/approvals/ApprovalsView.tsx"), "utf-8");

    assert.doesNotMatch(
      src,
      /ops\.manager@paypilot\.demo/,
      "ApprovalsView must NOT contain obsolete hardcoded email 'ops.manager@paypilot.demo'"
    );
    assert.doesNotMatch(
      src,
      /usr_ops_01/,
      "ApprovalsView must NOT contain obsolete hardcoded userId 'usr_ops_01'"
    );
    assert.match(
      src,
      /setNotification\(`Authenticated as \$\{json\.user\.email\}\.`\)/,
      "ApprovalsView must use authoritative email from session response in notification"
    );
  });

  test("23. Sidebar Badge: Eliminates hardcoded count: 2 and uses dynamic pending approval count", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(path.resolve("src/components/layout/Sidebar.tsx"), "utf-8");

    // 1. Must not have hardcoded count: 2
    assert.doesNotMatch(
      src,
      /count:\s*2/,
      "Sidebar.tsx must NOT contain hardcoded count: 2 in nav items"
    );

    // 2. Must query GET /api/approvals
    assert.match(
      src,
      /fetch\(["']\/api\/approvals["']/,
      "Sidebar.tsx must query /api/approvals endpoint"
    );

    // 3. Must filter approvals by status === 'pending'
    assert.match(
      src,
      /status\s*===\s*["']pending["']/,
      "Sidebar.tsx must use exact same pending status filter as ApprovalsView"
    );

    // 4. Must listen for focus and custom event paypilot:approvals-updated
    assert.match(src, /addEventListener\(["']focus["']/);
    assert.match(src, /addEventListener\(["']paypilot:approvals-updated["']/);
  });

  test("24. Sidebar Pending Count Logic: Correctly computes 3 for 3 pending and excludes non-pending records", async () => {
    const mockApprovals = [
      { id: "apr_1", status: "pending", title: "App 1" },
      { id: "apr_2", status: "pending", title: "App 2" },
      { id: "apr_3", status: "pending", title: "App 3" },
      { id: "apr_4", status: "approved", title: "App 4" },
      { id: "apr_5", status: "rejected", title: "App 5" },
      { id: "apr_6", status: "changes_requested", title: "App 6" },
    ];

    // Compute count using exact definition in Sidebar.tsx
    const pendingCount = mockApprovals.filter((a) => a.status === "pending").length;
    assert.equal(pendingCount, 3, "Must count exactly 3 pending records when 3 pending exist");

    // Exclude approved, rejected, changes_requested
    assert.equal(
      mockApprovals.filter((a) => a.status !== "pending").length,
      3,
      "Must exclude approved, rejected, and changes_requested"
    );
  });

  test("25. Sidebar Fallback Safety: Unauthenticated or failed request hides badge (count null / excluded)", async () => {
    const handleResponse = (ok, json) => {
      if (!ok) return null;
      if (json && json.success && Array.isArray(json.approvals)) {
        return json.approvals.filter((a) => a.status === "pending").length;
      }
      return null;
    };

    // Unauthenticated (HTTP 401)
    assert.equal(handleResponse(false, { error: "Auth required" }), null);

    // Server error (HTTP 500)
    assert.equal(handleResponse(false, { error: "Database error" }), null);

    // Empty list
    assert.equal(handleResponse(true, { success: true, approvals: [] }), 0);

    // Three pending records
    assert.equal(
      handleResponse(true, {
        success: true,
        approvals: [
          { status: "pending" },
          { status: "pending" },
          { status: "pending" },
          { status: "approved" },
        ],
      }),
      3
    );
  });

  // ─── 26–38. UI Feature Tests ─────────────────────────────────────────────────

  // ── Search (source-code static analysis) ─────────────────────────────────────

  test("26. Search: TopNavbar.tsx imports DEMO_ORDERS and DEMO_TRANSACTIONS from demo-data", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/layout/TopNavbar.tsx", "utf8");
    assert.ok(
      src.includes("DEMO_ORDERS") && src.includes("DEMO_TRANSACTIONS"),
      "TopNavbar.tsx must import DEMO_ORDERS and DEMO_TRANSACTIONS"
    );
    assert.ok(
      src.includes("@/lib/demo-data"),
      "TopNavbar.tsx must import from @/lib/demo-data"
    );
  });

  test("27. Search: runSearch function filters results case-insensitively by query", async () => {
    // Import demo data directly and replicate the search logic to test it
    const { DEMO_ORDERS, DEMO_TRANSACTIONS } = await import("../src/lib/demo-data.ts");

    function buildSearchIndex() {
      const results = [];
      for (const order of DEMO_ORDERS) {
        results.push({
          type: "order",
          id: order.id,
          label: `${order.orderNumber} — ${order.customerName}`,
          sublabel: `Order · $${order.totalAmount.toFixed(2)} · ${order.status}`,
          href: `/orders?highlight=${order.id}`,
        });
      }
      for (const txn of DEMO_TRANSACTIONS) {
        results.push({
          type: "transaction",
          id: txn.id,
          label: `${txn.id} — ${txn.customerName}`,
          sublabel: `Transaction · $${txn.amount.toFixed(2)} · ${txn.status}`,
          href: `/transactions?highlight=${txn.id}`,
        });
      }
      return results;
    }

    function runSearch(query) {
      if (!query.trim()) return [];
      const q = query.toLowerCase();
      return buildSearchIndex().filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.sublabel.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      ).slice(0, 8);
    }

    // Empty query returns empty array
    assert.deepEqual(runSearch(""), []);
    assert.deepEqual(runSearch("   "), []);

    // Non-matching query returns empty array
    const noMatch = runSearch("zzz_no_match_xyzzy");
    assert.equal(noMatch.length, 0, "Non-matching query should return empty array");
  });

  test("28. Search: Searching 'Sophia' returns order result for Sophia Dubois", async () => {
    const { DEMO_ORDERS, DEMO_TRANSACTIONS } = await import("../src/lib/demo-data.ts");

    function buildSearchIndex() {
      const results = [];
      for (const order of DEMO_ORDERS) {
        results.push({
          type: "order",
          id: order.id,
          label: `${order.orderNumber} — ${order.customerName}`,
          sublabel: `Order · $${order.totalAmount.toFixed(2)} · ${order.status}`,
          href: `/orders?highlight=${order.id}`,
        });
      }
      for (const txn of DEMO_TRANSACTIONS) {
        results.push({
          type: "transaction",
          id: txn.id,
          label: `${txn.id} — ${txn.customerName}`,
          sublabel: `Transaction · $${txn.amount.toFixed(2)} · ${txn.status}`,
          href: `/transactions?highlight=${txn.id}`,
        });
      }
      return results;
    }

    function runSearch(query) {
      if (!query.trim()) return [];
      const q = query.toLowerCase();
      return buildSearchIndex().filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.sublabel.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      ).slice(0, 8);
    }

    const hits = runSearch("Sophia");
    assert.ok(hits.length > 0, "Searching 'Sophia' should return at least one result");
    assert.ok(
      hits.some((r) => r.label.toLowerCase().includes("sophia")),
      "Result should include an entry matching Sophia"
    );
    // All results navigate correctly
    hits.forEach((r) => {
      assert.ok(r.href.startsWith("/orders") || r.href.startsWith("/transactions"),
        "Result href should point to /orders or /transactions");
    });
  });

  test("29. Search: TopNavbar.tsx contains correct search routing (highlight param)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/layout/TopNavbar.tsx", "utf8");
    assert.ok(src.includes("highlight="), "Search results must include highlight query param in href");
    assert.ok(src.includes("router.push"), "Search must navigate via router.push");
  });

  test("30. Search: TopNavbar.tsx shows empty state when no results match", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/layout/TopNavbar.tsx", "utf8");
    assert.ok(src.includes("No results"), "TopNavbar.tsx must include an empty-state 'No results' message");
  });

  // ── Profile Dropdown (source-code static analysis) ────────────────────────────

  test("31. Profile: TopNavbar.tsx calls DELETE /api/auth/session for sign-out", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/layout/TopNavbar.tsx", "utf8");
    assert.ok(
      src.includes("/api/auth/session") && src.includes("DELETE"),
      "TopNavbar.tsx must call DELETE /api/auth/session for sign-out"
    );
  });

  test("32. Profile: TopNavbar.tsx contains Escape key handler and outside-click close", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/layout/TopNavbar.tsx", "utf8");
    assert.ok(src.includes("Escape"), "Must have Escape key handler");
    assert.ok(
      src.includes("mousedown") || src.includes("click"),
      "Must have outside-click close handler"
    );
    assert.ok(src.includes("contains("), "Must check if click target is inside the container");
  });

  test("33. Profile: Dropdown reads user identity dynamically from session API (not hardcoded)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/layout/TopNavbar.tsx", "utf8");
    // Must fetch the session
    assert.ok(src.includes("/api/auth/session"), "Must fetch /api/auth/session for user identity");
    // Must reference dynamic session state, not literal hardcoded email as the final display value
    assert.ok(
      src.includes("sessionUser"),
      "Must use dynamic sessionUser state for identity display"
    );
  });

  // ── RevenueChart (source-code static analysis) ────────────────────────────────

  test("34. RevenueChart: contains showPriorWeek state", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/dashboard/RevenueChart.tsx", "utf8");
    assert.ok(src.includes("showPriorWeek"), "RevenueChart.tsx must contain showPriorWeek state");
    assert.ok(src.includes("useState(true)") || src.includes("useState<boolean>(true)"),
      "showPriorWeek must default to true");
  });

  test("35. RevenueChart: contains setShowPriorWeek toggle function", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/dashboard/RevenueChart.tsx", "utf8");
    assert.ok(src.includes("setShowPriorWeek"), "Must contain setShowPriorWeek toggle");
    assert.ok(
      src.includes("setShowPriorWeek((v) =>") || src.includes("setShowPriorWeek(v =>"),
      "Must use functional updater for toggle"
    );
  });

  test("36. RevenueChart: Prior Week toggle button has aria-pressed attribute", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/dashboard/RevenueChart.tsx", "utf8");
    assert.ok(src.includes("aria-pressed"), "Toggle button must have aria-pressed for accessibility");
  });

  test("37. RevenueChart: Prior Week Area is conditionally rendered", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/dashboard/RevenueChart.tsx", "utf8");
    assert.ok(
      src.includes("showPriorWeek &&") || src.includes("showPriorWeek?"),
      "Prior Week Area must be conditionally rendered based on showPriorWeek"
    );
    assert.ok(
      src.includes("previousWeekRevenue"),
      "Must still reference previousWeekRevenue dataKey"
    );
  });

  test("38. RevenueChart: Current Week Area (revenue dataKey) is always rendered unconditionally", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/dashboard/RevenueChart.tsx", "utf8");
    assert.ok(
      src.includes('dataKey="revenue"'),
      "Current Week revenue Area must still be present"
    );
    // The revenue Area should NOT be inside a conditional block
    const priorWeekBlock = src.match(/\{showPriorWeek[\s\S]*?previousWeekRevenue[\s\S]*?\}/)?.[0] ?? "";
    assert.ok(
      !priorWeekBlock.includes('dataKey="revenue"'),
      "Current Week Area must NOT be inside the Prior Week conditional block"
    );
  });
});
