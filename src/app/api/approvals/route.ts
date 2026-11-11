/**
 * /api/approvals — List and Create approval requests (Protected)
 *
 * GET  /api/approvals?status=pending   → list approvals (requires authenticated session)
 * POST /api/approvals                  → create a new pending approval (requires authenticated session)
 *
 * SECURITY:
 * - All requests MUST be authenticated. Unauthenticated calls receive HTTP 401.
 * - Multi-tenant / business isolation is strictly enforced.
 * - Actor identity is derived strictly from the verified server-side session.
 * - Client-supplied `actor_id` values in request bodies are explicitly rejected.
 */

import { NextRequest, NextResponse } from "next/server.js";
import { createApproval, listApprovals } from "../../../lib/server/approvals-store.ts";
import { verifyRequestSession } from "../../../lib/auth/session.ts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce server-side session verification
    const session = await verifyRequestSession(req);
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: session.error || "Authentication required. Please log in to view approval records.",
        },
        { status: session.statusCode || 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") ?? undefined;
    const businessId = session.user.business_id || "biz_paypilot_demo_01";

    const result = await listApprovals(statusFilter, businessId);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        approvals: result.data,
        count: result.data?.length ?? 0,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (err) {
    console.error("[API /api/approvals GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce server-side session verification
    const session = await verifyRequestSession(req);
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: session.error || "Authentication required. Please log in to submit approval requests.",
        },
        { status: session.statusCode || 401 }
      );
    }

    const rawBody = await req.json().catch(() => null);

    // 2. Reject client-supplied actor_id attempts
    if (rawBody && typeof rawBody === "object" && "actor_id" in rawBody) {
      return NextResponse.json(
        {
          success: false,
          error: "Security violation: actor_id cannot be specified in the request body. Identity is derived strictly from the verified session.",
        },
        { status: 400 }
      );
    }

    // 3. Derive authoritative actor identity and business ownership from verified session
    const actorIdentity = session.user.email || session.user.id;
    const businessId = session.user.business_id || "biz_paypilot_demo_01";
    const result = await createApproval(rawBody, actorIdentity, businessId);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode }
      );
    }

    return NextResponse.json(
      { success: true, approval: result.data },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (err) {
    console.error("[API /api/approvals POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
