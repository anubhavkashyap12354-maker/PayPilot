import { NextRequest, NextResponse } from "next/server";
import { serverOrdersStore } from "@/lib/server/orders-store";
import { PayPalService } from "@/lib/paypal/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload. 'orderId' is required.",
        },
        { status: 400 }
      );
    }

    // 1. Authoritative server-side order retrieval
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

    // 2. Order eligibility validation
    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Order '${order.orderNumber}' is not eligible for payment. Current status: ${order.status}.`,
        },
        { status: 400 }
      );
    }

    if (order.totalAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Order amount must be greater than zero. Received: ${order.totalAmount}`,
        },
        { status: 400 }
      );
    }

    // 3. Resolve dynamic return and cancel URLs
    const origin = req.nextUrl.origin || "http://localhost:3000";
    const returnUrl = `${origin}/orders?paypal_return=success&orderId=${encodeURIComponent(
      order.id
    )}`;
    const cancelUrl = `${origin}/orders?paypal_return=cancel&orderId=${encodeURIComponent(
      order.id
    )}`;

    // 4. Generate idempotency key for PayPal-Request-Id
    const idempotencyKey = `req_${order.id}_${Date.now()}`;

    // 5. Create PayPal Sandbox Order
    const paypalResult = await PayPalService.createOrder(
      order,
      returnUrl,
      cancelUrl,
      idempotencyKey
    );

    // 6. Map and store PayPal Order ID to demo order
    await serverOrdersStore.linkPayPalOrder(order.id, paypalResult.paypalOrderId);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
      currency: order.currency,
      paypalOrderId: paypalResult.paypalOrderId,
      approvalUrl: paypalResult.approvalUrl,
      status: paypalResult.status,
      isMockSandbox: Boolean(paypalResult.isMockSandbox),
    });
  } catch (error) {
    console.error("[API /api/paypal/create-order] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error during order creation.",
      },
      { status: 500 }
    );
  }
}
