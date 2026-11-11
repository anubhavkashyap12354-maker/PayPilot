import type {
  Order,
  PayPalConfigStatus,
  VerifyWebhookSignatureParams,
} from "../../types/index.ts";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

export class PayPalService {
  private static getCredentials() {
    const environment = process.env.PAYPAL_ENVIRONMENT || "sandbox";
    const clientId = process.env.PAYPAL_CLIENT_ID || "";
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    const baseUrl =
      process.env.PAYPAL_BASE_URL ||
      (environment === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com");

    const isConfigured =
      Boolean(clientId) &&
      Boolean(clientSecret) &&
      !clientId.includes("your-sandbox") &&
      !clientSecret.includes("your-sandbox");

    return { environment, clientId, clientSecret, baseUrl, isConfigured };
  }

  static isConfigured(): boolean {
    return this.getCredentials().isConfigured;
  }

  static getBaseUrl(): string {
    return this.getCredentials().baseUrl;
  }

  static getWebhookId(): string {
    return process.env.PAYPAL_WEBHOOK_ID || "";
  }

  /**
   * Verifies incoming webhook signature using official PayPal REST API
   * POST /v1/notifications/verify-webhook-signature
   */
  static async verifyWebhookSignature(
    params: VerifyWebhookSignatureParams
  ): Promise<boolean> {
    const { baseUrl, isConfigured } = this.getCredentials();

    if (!isConfigured) {
      // In unconfigured / mock mode, validate required signature headers exist
      const hasHeaders = Boolean(
        params.transmissionId &&
        params.transmissionTime &&
        params.certUrl &&
        params.authAlgo &&
        params.transmissionSig
      );
      return hasHeaders;
    }

    const token = await this.getAccessToken();

    const payload = {
      transmission_id: params.transmissionId,
      transmission_time: params.transmissionTime,
      cert_url: params.certUrl,
      auth_algo: params.authAlgo,
      transmission_sig: params.transmissionSig,
      webhook_id: params.webhookId,
      webhook_event: params.webhookEvent,
    };

    const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("[PayPal Service] Webhook verification request failed:", response.status);
      return false;
    }

    const data = await response.json();
    return data.verification_status === "SUCCESS";
  }

  /**
   * Retrieves an OAuth 2.0 access token with automatic caching and renewal
   */
  static async getAccessToken(forceRefresh = false): Promise<string> {
    const { clientId, clientSecret, baseUrl, isConfigured } = this.getCredentials();

    if (!isConfigured) {
      throw new Error(
        "PayPal Sandbox credentials are not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local."
      );
    }

    // Return cached token if valid for at least another 60 seconds
    const now = Date.now();
    if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + 60000) {
      return cachedToken.accessToken;
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: Record<string, unknown> = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      console.error("[PayPal Service] OAuth token exchange failed:", response.status, errorData);
      throw new Error(
        `PayPal OAuth error (${response.status}): ${
          errorData.error_description || errorData.message || "Failed to authenticate with PayPal Sandbox"
        }`
      );
    }

    const tokenData = await response.json();
    cachedToken = {
      accessToken: tokenData.access_token,
      expiresAt: now + (tokenData.expires_in || 32400) * 1000,
    };

    return cachedToken.accessToken;
  }

  /**
   * Validates Sandbox configuration and tests OAuth connectivity
   */
  static async checkStatus(): Promise<PayPalConfigStatus> {
    const { environment, clientId, clientSecret, isConfigured } = this.getCredentials();

    if (!isConfigured) {
      return {
        state: "not_configured",
        environment: environment as "sandbox" | "production",
        clientIdConfigured: Boolean(clientId && !clientId.includes("your-sandbox")),
        clientSecretConfigured: Boolean(clientSecret && !clientSecret.includes("your-sandbox")),
        message: "PayPal Sandbox is not configured. Running in simulated test mode.",
        details: "Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env.local to test real Sandbox orders.",
      };
    }

    try {
      await this.getAccessToken(true);
      return {
        state: "connection_successful",
        environment: environment as "sandbox" | "production",
        clientIdConfigured: true,
        clientSecretConfigured: true,
        message: "Successfully connected to PayPal Sandbox REST API v2.",
        details: `Authenticated via OAuth 2.0 (${environment})`,
      };
    } catch (err) {
      return {
        state: "connection_failed",
        environment: environment as "sandbox" | "production",
        clientIdConfigured: true,
        clientSecretConfigured: true,
        message: "Failed to connect to PayPal Sandbox API.",
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Creates a PayPal Orders v2 Order with intent CAPTURE
   */
  static async createOrder(
    order: Order,
    returnUrl: string,
    cancelUrl: string,
    idempotencyKey?: string
  ): Promise<{ paypalOrderId: string; approvalUrl: string; status: string; isMockSandbox?: boolean }> {
    const { baseUrl, isConfigured } = this.getCredentials();

    // If sandbox credentials are not configured, simulate sandbox checkout url
    if (!isConfigured) {
      const mockPaypalOrderId = `MOCK-SANDBOX-${Date.now().toString().slice(-8)}`;
      const separator = returnUrl.includes("?") ? "&" : "?";
      const approvalUrl = `${returnUrl}${separator}paypal_sandbox_modal=1&token=${mockPaypalOrderId}&PayerID=MOCK-PAYER-${Date.now().toString().slice(-6)}`;

      return {
        paypalOrderId: mockPaypalOrderId,
        approvalUrl,
        status: "CREATED",
        isMockSandbox: true,
      };
    }

    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    if (idempotencyKey) {
      headers["PayPal-Request-Id"] = idempotencyKey;
    }

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.orderNumber,
          description: `PayPilot Order ${order.orderNumber} - ${order.customerName}`,
          custom_id: order.id,
          amount: {
            currency_code: order.currency || "USD",
            value: Number(order.totalAmount).toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "PayPilot Operations",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[PayPal Service] Create Order API Error:", response.status, data);
      throw new Error(
        `PayPal create order failed (${response.status}): ${
          data.message || data.details?.[0]?.description || "Unable to initiate PayPal Sandbox Order"
        }`
      );
    }

    const approvalLink = data.links?.find(
      (link: { rel: string; href: string }) => link.rel === "approve"
    );

    if (!approvalLink?.href) {
      throw new Error("PayPal response did not include a valid buyer approval URL.");
    }

    return {
      paypalOrderId: data.id,
      approvalUrl: approvalLink.href,
      status: data.status,
      isMockSandbox: false,
    };
  }

  /**
   * Retrieves order details from PayPal Orders v2 API
   */
  static async getOrderDetails(paypalOrderId: string): Promise<Record<string, unknown>> {
    const { baseUrl, isConfigured } = this.getCredentials();

    if (!isConfigured) {
      return {
        id: paypalOrderId,
        status: "APPROVED",
        isMockSandbox: true,
      };
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Failed to retrieve PayPal order details (${response.status}): ${err.message || ""}`);
    }

    return await response.json();
  }

  /**
   * Captures an approved PayPal order
   */
  static async captureOrder(
    paypalOrderId: string,
    idempotencyKey?: string
  ): Promise<{
    captureId: string;
    status: "COMPLETED" | "PENDING" | "FAILED";
    amount: number;
    currency: string;
    isMockSandbox?: boolean;
    rawResponse?: unknown;
  }> {
    const { baseUrl, isConfigured } = this.getCredentials();

    if (!isConfigured || paypalOrderId.startsWith("MOCK-SANDBOX-")) {
      const mockCaptureId = `CAP-MOCK-${Date.now().toString().slice(-8)}`;
      return {
        captureId: mockCaptureId,
        status: "COMPLETED",
        amount: 0, // Will be resolved by caller using internal order amount
        currency: "USD",
        isMockSandbox: true,
      };
    }

    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    if (idempotencyKey) {
      headers["PayPal-Request-Id"] = idempotencyKey;
    }

    const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: "POST",
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[PayPal Service] Capture API Error:", response.status, data);

      // Handle duplicate capture idempotently if order was already captured
      if (
        data.name === "ORDER_ALREADY_CAPTURED" ||
        data.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED"
      ) {
        // Query order details to extract existing capture info
        const details = (await this.getOrderDetails(paypalOrderId)) as {
          status: string;
          purchase_units?: Array<{
            payments?: {
              captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }>;
            };
          }>;
        };

        const existingCapture = details.purchase_units?.[0]?.payments?.captures?.[0];
        if (existingCapture) {
          return {
            captureId: existingCapture.id,
            status: existingCapture.status as "COMPLETED" | "PENDING" | "FAILED",
            amount: Number(existingCapture.amount.value),
            currency: existingCapture.amount.currency_code,
            isMockSandbox: false,
            rawResponse: details,
          };
        }
      }

      throw new Error(
        `PayPal capture failed (${response.status}): ${
          data.message || data.details?.[0]?.description || "Capture authorization rejected"
        }`
      );
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id || data.id;
    const captureStatus = (capture?.status || data.status) as "COMPLETED" | "PENDING" | "FAILED";
    const amount = capture?.amount?.value ? Number(capture.amount.value) : 0;
    const currency = capture?.amount?.currency_code || "USD";

    return {
      captureId,
      status: captureStatus,
      amount,
      currency,
      isMockSandbox: false,
      rawResponse: data,
    };
  }
}
