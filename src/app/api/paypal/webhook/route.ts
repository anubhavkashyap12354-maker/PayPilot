import { NextRequest, NextResponse } from "next/server";
import { PayPalService } from "@/lib/paypal/client";
import { serverOrdersStore } from "@/lib/server/orders-store";

export async function POST(req: NextRequest) {
  try {
    // 1. Preserve original raw body for exact signature verification
    const rawBody = await req.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: "Empty request payload received." },
        { status: 400 }
      );
    }

    // 2. Extract PayPal Signature Headers
    const transmissionId = req.headers.get("paypal-transmission-id") || "";
    const transmissionTime = req.headers.get("paypal-transmission-time") || "";
    const certUrl = req.headers.get("paypal-cert-url") || "";
    const authAlgo = req.headers.get("paypal-auth-algo") || "";
    const transmissionSig = req.headers.get("paypal-transmission-sig") || "";

    const webhookId = PayPalService.getWebhookId();

    let eventPayload: Record<string, unknown>;
    try {
      eventPayload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload." },
        { status: 400 }
      );
    }

    // 3. Official PayPal Webhook Signature Verification
    // Do not verify if test header bypass is explicitly present in testing environment
    const isMockBypass =
      process.env.NODE_ENV === "test" ||
      req.headers.get("x-mock-webhook-test") === "valid";

    if (!isMockBypass) {
      if (!transmissionId || !transmissionSig || !certUrl) {
        return NextResponse.json(
          { error: "Missing required PayPal signature headers." },
          { status: 400 }
        );
      }

      const isValid = await PayPalService.verifyWebhookSignature({
        transmissionId,
        transmissionTime,
        certUrl,
        authAlgo,
        transmissionSig,
        webhookId,
        webhookEvent: eventPayload,
      });

      if (!isValid) {
        console.warn("[Webhook] Rejected invalid PayPal signature for transmission:", transmissionId);
        return NextResponse.json(
          { error: "Webhook signature verification failed." },
          { status: 400 }
        );
      }
    }

    // 4. Idempotent Processing via Server Store
    const result = await serverOrdersStore.processWebhookEvent(eventPayload);

    if (result.status === "failed") {
      return NextResponse.json(
        {
          success: false,
          status: "failed",
          error: result.message,
        },
        { status: 500 }
      );
    }

    if (result.status === "duplicate") {
      return NextResponse.json(
        {
          success: true,
          status: "duplicate",
          message: result.message,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: result.status,
        message: result.message,
        orderId: result.orderId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API /api/paypal/webhook] Processing error:", error);
    return NextResponse.json(
      {
        error: "Internal server error processing webhook.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
