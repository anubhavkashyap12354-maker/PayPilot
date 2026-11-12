/**
 * /api/auth/session — Session verification & demo authentication management (Hardened)
 *
 * GET    /api/auth/session   → returns current verified user session or 401
 * POST   /api/auth/session   → establishes demo session IF AND ONLY IF PAYPILOT_DEMO_AUTH="true"
 * DELETE /api/auth/session   → clears the session cookie (logout)
 *
 * SECURITY:
 * - When PAYPILOT_DEMO_AUTH is absent or not "true", POST /api/auth/session returns HTTP 403 Forbidden.
 * - Demo authentication generates ONE fixed identity (FIXED_DEMO_USER); client-supplied emails or userIds are rejected/ignored.
 * - Missing session secrets fail closed.
 */

import { NextRequest, NextResponse } from "next/server.js";
import {
  verifyRequestSession,
  createSignedSessionToken,
  SESSION_COOKIE_NAME,
  FIXED_DEMO_USER,
} from "../../../../lib/auth/session.ts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = await verifyRequestSession(req);

  if (!result.authenticated || !result.user) {
    return NextResponse.json(
      { authenticated: false, error: result.error || "No active session." },
      { status: result.statusCode || 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role || "authenticated",
        business_id: result.user.business_id || "biz_paypilot_demo_01",
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  // 1. Demo Guard:
  // Demo session generation requires an explicit PAYPILOT_DEMO_AUTH="true"
  // environment variable. When absent or "false", demo login is disabled.
  const isDemoAuthEnabled = process.env.PAYPILOT_DEMO_AUTH === "true";

  if (!isDemoAuthEnabled) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Demo session generation is disabled in this environment. Production authentication requires configured Supabase Auth.",
      },
      { status: 403 }
    );
  }

  try {
    // 2. Demo mode must issue ONE fixed, clearly labelled demo identity.
    // Never accept arbitrary email or userId values from the request body!
    const user = FIXED_DEMO_USER;

    // Create cryptographically signed token (fails closed if secret missing)
    const token = createSignedSessionToken(user);

    const response = NextResponse.json(
      {
        success: true,
        authenticated: true,
        user,
        token,
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 24 hours
    });

    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to establish session.";
    console.error("[Auth API] Session establishment error:", errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json(
    { success: true, message: "Session ended." },
    { status: 200 }
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
