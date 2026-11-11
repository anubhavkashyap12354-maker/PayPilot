import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("PayPal Webhooks Integration & Security Tests", () => {
  let originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("1. Missing webhook configuration: Identifies unconfigured webhook ID gracefully", async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    const { PayPalService } = await import("../src/lib/paypal/client.ts?t=" + Date.now());
    const webhookId = PayPalService.getWebhookId();
    assert.equal(webhookId, "");
  });

  it("2. Invalid signature: Fails verification when PayPal verification API returns FAILURE", async () => {
    process.env.PAYPAL_CLIENT_ID = "mock_client";
    process.env.PAYPAL_CLIENT_SECRET = "mock_secret";
    process.env.PAYPAL_BASE_URL = "https://mock.sandbox.paypal.com";
    process.env.PAYPAL_WEBHOOK_ID = "WH-MOCK-ID-123";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock_token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/verify-webhook-signature")) {
        return new Response(
          JSON.stringify({ verification_status: "FAILURE" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    try {
      const { PayPalService } = await import("../src/lib/paypal/client.ts?t=" + Date.now());
      const isValid = await PayPalService.verifyWebhookSignature({
        transmissionId: "bad_tx_id",
        transmissionTime: new Date().toISOString(),
        certUrl: "https://api.sandbox.paypal.com/cert.pem",
        authAlgo: "SHA256withRSA",
        transmissionSig: "bad_signature",
        webhookId: "WH-MOCK-ID-123",
        webhookEvent: { id: "WH-EVENT-001" },
      });

      assert.equal(isValid, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("3. Valid verified webhook: Passes verification when official PayPal API returns SUCCESS", async () => {
    process.env.PAYPAL_CLIENT_ID = "mock_client";
    process.env.PAYPAL_CLIENT_SECRET = "mock_secret";
    process.env.PAYPAL_BASE_URL = "https://mock.sandbox.paypal.com";
    process.env.PAYPAL_WEBHOOK_ID = "WH-MOCK-ID-123";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock_token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/verify-webhook-signature")) {
        return new Response(
          JSON.stringify({ verification_status: "SUCCESS" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    try {
      const { PayPalService } = await import("../src/lib/paypal/client.ts?t=" + Date.now());
      const isValid = await PayPalService.verifyWebhookSignature({
        transmissionId: "valid_tx_id",
        transmissionTime: new Date().toISOString(),
        certUrl: "https://api.sandbox.paypal.com/cert.pem",
        authAlgo: "SHA256withRSA",
        transmissionSig: "valid_signature",
        webhookId: "WH-MOCK-ID-123",
        webhookEvent: { id: "WH-EVENT-002" },
      });

      assert.equal(isValid, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("4. PAYMENT.CAPTURE.COMPLETED: Marks payment as completed and order as processing (NOT fulfilled)", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    const event = {
      id: "WH-EVENT-CAPTURE-COMPLETED-101",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource_type: "capture",
      summary: "Payment capture completed for $520.00",
      resource: {
        id: "CAP-WH-991122",
        custom_id: "ord_003",
        amount: { value: "520.00", currency_code: "USD" },
        status: "COMPLETED",
        supplementary_data: {
          related_ids: { order_id: "5O190127TN364715T" },
        },
      },
    };

    const result = await serverOrdersStore.processWebhookEvent(event);
    assert.equal(result.status, "processed");
    assert.equal(result.orderId, "ord_003");

    const updatedOrder = await serverOrdersStore.getOrder("ord_003");
    // CRITICAL: Order status MUST be "processing", NOT "fulfilled"
    assert.equal(updatedOrder.status, "processing");
    assert.notEqual(updatedOrder.status, "fulfilled");
    assert.equal(updatedOrder.paypalCaptureId, "CAP-WH-991122");
  });

  it("5. Order fulfillment separation: Only an explicit fulfillment action marks order as fulfilled", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
    const orderBefore = await serverOrdersStore.getOrder("ord_003");
    assert.equal(orderBefore.status, "processing");

    const fulfilledOrder = await serverOrdersStore.fulfillOrder("ord_003", "PP-TRK-EXPEDITE-101");
    assert.equal(fulfilledOrder.status, "fulfilled");
    assert.equal(fulfilledOrder.trackingNumber, "PP-TRK-EXPEDITE-101");
  });

  it("6. Duplicate event delivery: Rejects re-processing the same event ID (Idempotency)", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    const duplicateEvent = {
      id: "WH-EVENT-CAPTURE-COMPLETED-101", // Exact same ID as previous test
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { custom_id: "ord_003" },
    };

    const result = await serverOrdersStore.processWebhookEvent(duplicateEvent);
    assert.equal(result.status, "duplicate");
    assert.match(result.message, /already recorded in the event ledger/i);
  });

  it("7. Concurrent duplicate deliveries: Handles parallel requests without duplicating ledger records", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    const concurrentEvent = {
      id: "WH-CONCURRENT-PARALLEL-999",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP-CONCURRENT-999",
        custom_id: "ord_003",
        amount: { value: "520.00", currency_code: "USD" },
      },
    };

    // Fire 5 identical requests concurrently
    const results = await Promise.all([
      serverOrdersStore.processWebhookEvent(concurrentEvent),
      serverOrdersStore.processWebhookEvent(concurrentEvent),
      serverOrdersStore.processWebhookEvent(concurrentEvent),
      serverOrdersStore.processWebhookEvent(concurrentEvent),
      serverOrdersStore.processWebhookEvent(concurrentEvent),
    ]);

    // Exactly one must succeed with "processed", all others must be flagged as "duplicate"
    const processedCount = results.filter((r) => r.status === "processed").length;
    const duplicateCount = results.filter((r) => r.status === "duplicate").length;

    assert.equal(processedCount, 1, "Only one execution should process");
    assert.equal(duplicateCount, 4, "Remaining 4 executions must be recognized as duplicate");
  });

  it("8. Failed event retry safety: A previously failed event can be retried safely", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    const retryEventId = "WH-RETRY-TRANSIENT-FAIL-01";

    // Manually record initial failed execution in ledger
    await serverOrdersStore.saveWebhookEvent({
      id: "wh_test_failed_rec",
      eventId: retryEventId,
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      status: "failed",
      payload: {},
      errorMessage: "Transient database connection timeout",
      receivedAt: new Date().toISOString(),
    });

    // Send the event again (simulating PayPal webhook retry)
    const retryEvent = {
      id: retryEventId,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP-RETRY-01",
        custom_id: "ord_003",
        amount: { value: "520.00", currency_code: "USD" },
      },
    };

    const result = await serverOrdersStore.processWebhookEvent(retryEvent);
    // Verified: Failed events are NOT locked out; they can be safely retried
    assert.equal(result.status, "processed");
  });

  it("9. Unknown event type: Safely ignored and recorded without breaking", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    const unknownEvent = {
      id: "WH-EVENT-UNKNOWN-999",
      event_type: "CUSTOMER.DISPUTE.CREATED",
      resource: { id: "DISP-123" },
    };

    const result = await serverOrdersStore.processWebhookEvent(unknownEvent);
    assert.equal(result.status, "ignored");
    assert.match(result.message, /not in the scope/i);
  });

  it("10. Event referring to unknown order: Safely ignored without modifying arbitrary records", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    const unlinkedEvent = {
      id: "WH-EVENT-ORPHAN-001",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP-ORPHAN-001",
        custom_id: "non_existent_order_id_8888",
        amount: { value: "100.00" },
      },
    };

    const result = await serverOrdersStore.processWebhookEvent(unlinkedEvent);
    assert.equal(result.status, "ignored");
    assert.match(result.message, /no matching PayPilot order/i);
  });

  it("11. PAYMENT.CAPTURE.DENIED: Updates payment status to failed and cancels order", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    const deniedEvent = {
      id: "WH-EVENT-DENIED-505",
      event_type: "PAYMENT.CAPTURE.DENIED",
      resource: {
        id: "CAP-DENIED-505",
        custom_id: "ord_007", // Liam O'Connor pending order
        status: "DENIED",
      },
    };

    const result = await serverOrdersStore.processWebhookEvent(deniedEvent);
    assert.equal(result.status, "processed");

    const order = await serverOrdersStore.getOrder("ord_007");
    assert.equal(order.status, "cancelled");
  });

  it("12. PAYMENT.CAPTURE.REFUNDED: Updates payment and order status to refunded", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    const refundEvent = {
      id: "WH-EVENT-REFUND-303",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: {
        id: "REF-303",
        custom_id: "ord_001",
        status: "COMPLETED",
      },
    };

    const result = await serverOrdersStore.processWebhookEvent(refundEvent);
    assert.equal(result.status, "processed");

    const order = await serverOrdersStore.getOrder("ord_001");
    assert.equal(order.status, "refunded");
  });

  it("13. RLS Security: Confirms migration 003 revokes public access and 004 adds security_invoker view", async () => {
    const fs = await import("node:fs");

    // ── Migration 003 checks ──────────────────────────────────────────────────
    const migration003 = fs.readFileSync(
      "supabase/migrations/003_paypal_webhooks.sql",
      "utf-8"
    );

    // Verify raw table grants are revoked from anon and authenticated
    assert.match(
      migration003,
      /REVOKE ALL ON paypal_webhook_events FROM anon, authenticated;/i,
      "Migration 003 must revoke raw table access from anon and authenticated"
    );

    // Verify only restricted view exposes non-sensitive columns
    assert.match(
      migration003,
      /CREATE OR REPLACE VIEW demo_webhook_audit_view/i,
      "Migration 003 must create a restricted audit view"
    );
    assert.doesNotMatch(
      migration003,
      /SELECT.*payload.*FROM paypal_webhook_events/i,
      "Restricted view must NOT expose raw payload"
    );

    // ── Migration 004 checks ──────────────────────────────────────────────────
    const migration004 = fs.readFileSync(
      "supabase/migrations/004_paypal_webhooks_security.sql",
      "utf-8"
    );

    // Verify SECURITY INVOKER is set on the view to prevent privilege escalation
    assert.match(
      migration004,
      /WITH \(security_invoker = true\)/i,
      "Migration 004 must set security_invoker = true on the audit view"
    );

    // Verify claimed_at column is added for multi-process atomic claiming
    assert.match(
      migration004,
      /ADD COLUMN IF NOT EXISTS claimed_at/i,
      "Migration 004 must add the claimed_at column for atomic event claiming"
    );

    // Verify view in 004 still excludes sensitive columns from SELECT list
    const view004Match = migration004.match(
      /CREATE VIEW demo_webhook_audit_view[\s\S]*?FROM paypal_webhook_events/i
    );
    assert.ok(view004Match, "Migration 004 must define demo_webhook_audit_view");
    assert.doesNotMatch(
      view004Match[0],
      /\bpayload\b/i,
      "Security-hardened view in 004 must NOT expose raw payload"
    );
    assert.doesNotMatch(
      view004Match[0],
      /\berror_message\b/i,
      "Security-hardened view in 004 must NOT expose error_message"
    );
  });

  it("14. Duplicate payment mutation guard: Calling completeOrderPayment twice with the same captureId is idempotent", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");

    // First call — should create the payment
    const captureId = "CAP-DEDUP-TEST-001";
    const result1 = await serverOrdersStore.completeOrderPayment(
      "ord_002",
      "PAYPAL-ORD-DEDUP-001",
      captureId,
      299.99,
      "processing"
    );
    assert.ok(result1, "First completeOrderPayment call must succeed");
    assert.equal(result1.order.paypalCaptureId, captureId);
    assert.equal(result1.order.status, "processing");

    const paymentId1 = result1.payment.id;
    const txnId1 = result1.transaction.id;

    // Second call with identical captureId — must return existing records, not create new ones
    const result2 = await serverOrdersStore.completeOrderPayment(
      "ord_002",
      "PAYPAL-ORD-DEDUP-001",
      captureId,
      299.99,
      "processing"
    );
    assert.ok(result2, "Second completeOrderPayment call must return existing records");
    assert.equal(result2.payment.id, paymentId1, "Must return the SAME payment record, not a new one");
    assert.equal(result2.transaction.id, txnId1, "Must return the SAME transaction record, not a new one");

    // Verify no duplicate transaction entries exist for this order
    const allTransactions = await serverOrdersStore.getAllTransactions();
    const txnsForCapture = allTransactions.filter(
      (t) => t.orderId === result1.order.orderNumber
    );
    // Allow at most 1 transaction for this capture (some demo data may have an existing one)
    const ppTxns = txnsForCapture.filter((t) => t.id.startsWith("TXN-PP-"));
    assert.ok(ppTxns.length <= 1, `Expected at most 1 PayPal transaction for this order, found ${ppTxns.length}`);
  });
});
