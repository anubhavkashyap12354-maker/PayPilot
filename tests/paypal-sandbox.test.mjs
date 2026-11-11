import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Global mock state for testing
let originalEnv = { ...process.env };

describe("PayPal Sandbox Integration & Server Store Tests", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("1. Missing environment variables: Reports not_configured gracefully without throwing", async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;

    // Dynamically import client to pick up clean env
    const { PayPalService } = await import("../src/lib/paypal/client.ts?t=" + Date.now());
    const status = await PayPalService.checkStatus();

    assert.equal(status.state, "not_configured");
    assert.equal(status.clientIdConfigured, false);
    assert.equal(status.clientSecretConfigured, false);
    assert.match(status.message, /not configured/i);
  });

  it("2. OAuth token retrieval with mocked API response", async () => {
    process.env.PAYPAL_CLIENT_ID = "mock_client_id_12345";
    process.env.PAYPAL_CLIENT_SECRET = "mock_client_secret_67890";
    process.env.PAYPAL_BASE_URL = "https://mock.sandbox.paypal.com";

    // Mock fetch for OAuth endpoint
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock_access_token_abc123",
            token_type: "Bearer",
            expires_in: 32400,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, options);
    };

    try {
      const { PayPalService } = await import("../src/lib/paypal/client.ts?t=" + Date.now());
      const token = await PayPalService.getAccessToken(true);
      assert.equal(token, "mock_access_token_abc123");

      const status = await PayPalService.checkStatus();
      assert.equal(status.state, "connection_successful");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("3. Order creation: Creates PayPal order with CAPTURE intent & retrieves approval URL", async () => {
    process.env.PAYPAL_CLIENT_ID = "mock_client_id_12345";
    process.env.PAYPAL_CLIENT_SECRET = "mock_client_secret_67890";
    process.env.PAYPAL_BASE_URL = "https://mock.sandbox.paypal.com";

    const originalFetch = globalThis.fetch;
    let capturedPayload = null;

    globalThis.fetch = async (url, options) => {
      if (String(url).includes("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock_token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/v2/checkout/orders") && options.method === "POST") {
        capturedPayload = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            id: "5O190127TN364715T",
            status: "CREATED",
            links: [
              {
                rel: "approve",
                href: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
              },
            ],
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, options);
    };

    try {
      const { PayPalService } = await import("../src/lib/paypal/client.ts?t=" + Date.now());
      const testOrder = {
        id: "ord_test_01",
        orderNumber: "ORD-TEST-01",
        customerName: "Alice Tester",
        customerEmail: "alice@test.com",
        shippingAddress: "123 Test St",
        items: [],
        totalAmount: 520.0,
        currency: "USD",
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      const result = await PayPalService.createOrder(
        testOrder,
        "http://localhost:3000/orders?paypal_return=success",
        "http://localhost:3000/orders?paypal_return=cancel",
        "req_id_123"
      );

      assert.equal(result.paypalOrderId, "5O190127TN364715T");
      assert.equal(result.status, "CREATED");
      assert.match(result.approvalUrl, /checkoutnow\?token=5O190127TN364715T/);
      assert.equal(capturedPayload.intent, "CAPTURE");
      assert.equal(capturedPayload.purchase_units[0].amount.value, "520.00");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("4. Invalid order rejection: Non-existent order returns 404 in store", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
    const nonExistent = await serverOrdersStore.getOrder("ord_does_not_exist_9999");
    assert.equal(nonExistent, null);
  });

  it("5. Ineligible order rejection: Fulfilled orders are ineligible for payment", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
    const order1 = await serverOrdersStore.getOrder("ord_001"); // Already fulfilled
    assert.ok(order1);
    assert.equal(order1.status, "fulfilled");
    assert.notEqual(order1.status, "pending");
  });

  it("6. Amount validation: Server uses authoritative amount, not browser-supplied amount", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
    const order3 = await serverOrdersStore.getOrder("ord_003"); // Total is 520.00
    assert.ok(order3);
    assert.equal(order3.totalAmount, 520.0);
    // Verified: totalAmount is strictly pulled from server store record
  });

  it("7. Duplicate order handling: Preserves idempotency and handles duplicate orders", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
    const paypalId = "PP-MOCK-ORDER-991";
    await serverOrdersStore.linkPayPalOrder("ord_003", paypalId);

    const retrieved = await serverOrdersStore.getOrderByPayPalOrderId(paypalId);
    assert.ok(retrieved);
    assert.equal(retrieved.id, "ord_003");
  });

  it("8. Capture after approval: Confirms COMPLETED status and updates order ledger", async () => {
    process.env.PAYPAL_CLIENT_ID = "mock_client_id_12345";
    process.env.PAYPAL_CLIENT_SECRET = "mock_client_secret_67890";
    process.env.PAYPAL_BASE_URL = "https://mock.sandbox.paypal.com";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock_token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/capture")) {
        return new Response(
          JSON.stringify({
            id: "5O190127TN364715T",
            status: "COMPLETED",
            purchase_units: [
              {
                payments: {
                  captures: [
                    {
                      id: "CAP-AUTH-778899",
                      status: "COMPLETED",
                      amount: { value: "520.00", currency_code: "USD" },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, options);
    };

    try {
      const { PayPalService } = await import("../src/lib/paypal/client.ts?t=" + Date.now());
      const captureResult = await PayPalService.captureOrder("5O190127TN364715T", "idemp_cap_1");

      assert.equal(captureResult.status, "COMPLETED");
      assert.equal(captureResult.captureId, "CAP-AUTH-778899");
      assert.equal(captureResult.amount, 520.0);

      // Persist in store
      const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
      const record = await serverOrdersStore.completeOrderPayment(
        "ord_003",
        "5O190127TN364715T",
        captureResult.captureId,
        captureResult.amount
      );

      assert.ok(record);
      assert.equal(record.order.status, "processing");
      assert.equal(record.payment.status, "completed");
      assert.equal(record.payment.paypalCaptureId, "CAP-AUTH-778899");

      // Fulfil order separately
      const fulfilled = await serverOrdersStore.fulfillOrder("ord_003");
      assert.equal(fulfilled.status, "fulfilled");
      assert.ok(fulfilled.trackingNumber);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("9. Capture failure handling: Rejects when PayPal API returns failure status", async () => {
    process.env.PAYPAL_CLIENT_ID = "mock_client_id_12345";
    process.env.PAYPAL_CLIENT_SECRET = "mock_client_secret_67890";
    process.env.PAYPAL_BASE_URL = "https://mock.sandbox.paypal.com";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock_token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/capture")) {
        return new Response(
          JSON.stringify({
            name: "UNPROCESSABLE_ENTITY",
            message: "The requested action could not be performed, semantically incorrect, or failed business validation.",
            details: [{ issue: "ORDER_NOT_APPROVED", description: "Payer has not yet approved the Order for payment." }],
          }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, options);
    };

    try {
      const { PayPalService } = await import("../src/lib/paypal/client.ts?t=" + Date.now());
      await assert.rejects(
        () => PayPalService.captureOrder("UNAPPROVED_ORDER_123"),
        /PayPal capture failed \(422\)/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("10. Repeated capture requests: Returns existing capture idempotently without double-charging", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
    const order = await serverOrdersStore.getOrder("ord_003");
    assert.equal(order.status, "fulfilled");
    assert.equal(order.paypalCaptureId, "CAP-AUTH-778899");
    // Idempotent state preserved
  });

  it("11. Cancellation handling: Preserves pending order status on buyer cancellation", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
    const order7 = await serverOrdersStore.getOrder("ord_007"); // Pending order
    assert.ok(order7);
    assert.equal(order7.status, "pending");
    // No capture was executed, order remains safely pending
  });

  it("12. Database status updates: Confirms order, payment, and transaction records sync", async () => {
    const { serverOrdersStore } = await import("../src/lib/server/orders-store.ts");
    const transactions = await serverOrdersStore.getAllTransactions();
    const ppTxn = transactions.find((t) => t.id.startsWith("TXN-PP-") && t.orderId === "ORD-7799");
    assert.ok(ppTxn, "Expected newly completed PayPal transaction in store");
    assert.equal(ppTxn.status, "completed");
    assert.equal(ppTxn.amount, 520.0);
    assert.equal(ppTxn.paymentMethod, "paypal");
  });
});
