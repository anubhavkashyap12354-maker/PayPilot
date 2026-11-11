import { NextRequest, NextResponse } from "next/server";
import { serverOrdersStore } from "@/lib/server/orders-store";
import { PayPalService } from "@/lib/paypal/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, paypalOrderId } = body;

    if (!orderId || !paypalOrderId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: 'orderId' and 'paypalOrderId' are mandatory.",
        },
        { status: 400 }
      );
    }

    // 1. Authoritative order retrieval
    const order = await serverOrdersStore.getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: `Order '${orderId}' not found in server ledger.`,
        },
        { status: 404 }
      );
    }

    // 2. Safe idempotent handling: Check if already completed with this capture ID
    if (order.status === "fulfilled" && order.paypalOrderId === paypalOrderId) {
      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        paypalOrderId,
        paypalCaptureId: order.paypalCaptureId || "ALREADY_CAPTURED",
        status: "COMPLETED",
        amount: order.totalAmount,
        currency: order.currency,
        transactionId: order.transactionId || "TXN-EXISTING",
        message: "Order was previously captured and fulfilled successfully.",
      });
    }

    // 3. Verify relationship between PayPilot Order and PayPal Order ID
    if (order.paypalOrderId && order.paypalOrderId !== paypalOrderId) {
      return NextResponse.json(
        {
          success: false,
          error: `Security mismatch: Order '${orderId}' is linked to PayPal Order '${order.paypalOrderId}', not '${paypalOrderId}'.`,
        },
        { status: 403 }
      );
    }

    // 4. Verify order eligibility
    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Order cannot be captured. Current status is '${order.status}'.`,
        },
        { status: 400 }
      );
    }

    // 5. Authoritative PayPal Capture Execution
    const idempotencyKey = `cap_${order.id}_${Date.now()}`;
    const captureResult = await PayPalService.captureOrder(paypalOrderId, idempotencyKey);

    if (captureResult.status !== "COMPLETED" && captureResult.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: `PayPal reported non-successful capture status: ${captureResult.status}`,
          status: captureResult.status,
        },
        { status: 402 }
      );
    }

    // 6. Verified Amount reconciliation
    const verifiedAmount =
      captureResult.amount > 0 ? captureResult.amount : order.totalAmount;

    // 7. Update Server Records: Order, Payment, and Transaction Ledger
    const updateResult = await serverOrdersStore.completeOrderPayment(
      order.id,
      paypalOrderId,
      captureResult.captureId,
      verifiedAmount
    );

    if (!updateResult) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to persist order fulfillment state.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: updateResult.order.id,
      orderNumber: updateResult.order.orderNumber,
      paypalOrderId,
      paypalCaptureId: captureResult.captureId,
      status: captureResult.status,
      amount: verifiedAmount,
      currency: order.currency,
      transactionId: updateResult.transaction.id,
      trackingNumber: updateResult.order.trackingNumber,
      isMockSandbox: Boolean(captureResult.isMockSandbox),
    });
  } catch (error) {
    console.error("[API /api/paypal/capture-order] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Capture processing failed.",
      },
      { status: 500 }
    );
  }
}
