/**
 * /api/approvals/[id] — Fetch, decide, and audit individual approvals (Protected)
 *
 * GET    /api/approvals/:id           → fetch a single approval (requires authenticated session)
 * PATCH  /api/approvals/:id           → record approval decision (requires authenticated session)
 * GET    /api/approvals/:id?audit=true → fetch audit history (requires authenticated session)
 *
 * SECURITY:
 * - All requests MUST be authenticated. Unauthenticated calls receive HTTP 401.
 * - Multi-tenant / business isolation is strictly enforced (cross-tenant calls receive HTTP 403).
 * - Actor identity is derived strictly from the verified server-side session.
 * - Client-supplied `actor_id` values in request bodies are explicitly rejected (HTTP 400).
 * - Implements single-transaction atomic decision and audit recording (HTTP 409 on conflicts).
 */

import { NextRequest, NextResponse } from "next/server.js";
import {
  getApproval,
  decideApproval,
  getApprovalAuditHistory,
} from "../../../../lib/server/approvals-store.ts";
import { verifyRequestSession } from "../../../../lib/auth/session.ts";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const wantAudit = searchParams.get("audit") === "true";
    const businessId = session.user.business_id || "biz_paypilot_demo_01";

    if (wantAudit) {
      const result = await getApprovalAuditHistory(id, businessId);
      if (result.error) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: result.statusCode }
        );
      }
      return NextResponse.json(
        { success: true, auditHistory: result.data },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const result = await getApproval(id, businessId);
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode }
      );
    }

    return NextResponse.json(
      { success: true, approval: result.data },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    console.error("[API /api/approvals/[id] GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. Enforce server-side session verification
    const session = await verifyRequestSession(req);
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: session.error || "Authentication required. Please log in to record approval decisions.",
        },
        { status: session.statusCode || 401 }
      );
    }

    const { id } = await params;
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
    const result = await decideApproval(id, rawBody, actorIdentity, businessId);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        approval: result.data,
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
    console.error("[API /api/approvals/[id] PATCH] Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
