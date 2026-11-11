import { NextResponse } from "next/server";
import { PayPalService } from "@/lib/paypal/client";

export async function GET() {
  try {
    const status = await PayPalService.checkStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[API /api/paypal/status] Error:", error);
    return NextResponse.json(
      {
        state: "connection_failed",
        environment: "sandbox",
        clientIdConfigured: false,
        clientSecretConfigured: false,
        message: "Failed to evaluate PayPal connection status.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
