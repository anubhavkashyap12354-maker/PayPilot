/**
 * PayPilot Authentication & Server Session Verification Layer — Phase 3D.4 Hardened
 *
 * SECURITY CONTRACT:
 * - Deterministic token-provider routing:
 *   1. Tokens from dedicated `paypilot_session` cookie are verified EXCLUSIVELY using local HMAC.
 *      They are NEVER dispatched to Supabase Auth.
 *   2. Supabase access tokens (`sb-access-token`) and standard Bearer JWTs (`Authorization: Bearer`)
 *      are verified EXCLUSIVELY through Supabase Auth (`supabase.auth.getUser()`).
 *      If Supabase verification fails, returns 401 immediately with ZERO fallback to HMAC.
 * - Local demo-token verification is permitted IF AND ONLY IF BOTH conditions hold:
 *   - `NODE_ENV !== "production"`
 *   - `PAYPILOT_DEMO_AUTH === "true"`
 * - Constant-time HMAC-SHA256 signature verification prevents timing attacks.
 * - Claims in tokens are NEVER trusted before cryptographic signature verification.
 * - If required session secret is missing, fails closed with a clear server-side error.
 * - Fixed demo identity only; arbitrary email or userId client input is ignored.
 */

import { NextRequest } from "next/server.js";
import crypto from "node:crypto";
import { getSupabaseAdminClient } from "../supabase/admin.ts";
import { getSupabaseClient } from "../supabase/client.ts";

export const SESSION_COOKIE_NAME = "paypilot_session";

let testSupabaseClientOverride: { auth: { getUser: (token: string) => Promise<any> } } | null = null;

export function __setTestSupabaseClient(client: any): void {
  testSupabaseClientOverride = client;
}

/** Fixed, non-spoofable demo identity issued in authorized local development/testing */
export const FIXED_DEMO_USER: Readonly<AuthenticatedUser> = Object.freeze({
  id: "usr_paypilot_demo_operator",
  email: "demo-operator@paypilot.local",
  role: "authenticated",
  business_id: "biz_paypilot_demo_01",
});

export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
  business_id?: string;
}

export interface SessionVerificationResult {
  authenticated: boolean;
  user?: AuthenticatedUser;
  error?: string;
  statusCode?: number;
}

export interface ExtractedCredential {
  token: string;
  source: "paypilot_session" | "supabase";
}

/**
 * Resolves session signing secret.
 * FAILS CLOSED: Throws fatal error if no secret is configured in the environment.
 * NEVER uses a hardcoded fallback secret in source code.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "CRITICAL AUTH CONFIG ERROR: SESSION_SECRET is not configured. Server fails closed."
    );
  }
  return secret;
}

/**
 * Creates a cryptographically signed session token for authorized local demo/testing.
 * Stamped with `iss: "paypilot-demo"` to clearly identify its issuer.
 * Structure: Base64Url(header) + "." + Base64Url(payload) + "." + HMAC_SHA256_Signature
 */
export function createSignedSessionToken(
  user: AuthenticatedUser,
  expiresInSeconds: number = 86400
): string {
  const secret = getSessionSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "paypilot-demo",
    sub: user.id,
    email: user.email,
    role: user.role || "authenticated",
    business_id: user.business_id || "biz_paypilot_demo_01",
    iat: now,
    exp: now + expiresInSeconds,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const dataToSign = `${b64Header}.${b64Payload}`;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(dataToSign);
  const signature = hmac.digest("base64url");

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token using constant-time comparison.
 * Critical: Token claims are NEVER trusted until signature verification succeeds.
 */
export function verifyLocalSessionToken(
  token: string
): { valid: boolean; user?: AuthenticatedUser; error?: string } {
  let secret: string;
  try {
    secret = getSessionSecret();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Missing secret";
    return { valid: false, error: msg };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed session token format." };
  }

  const [b64Header, b64Payload, signature] = parts;
  const dataToSign = `${b64Header}.${b64Payload}`;

  // Constant-time signature verification to prevent timing attacks
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(dataToSign);
  const expectedSig = hmac.digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return { valid: false, error: "Invalid session token signature." };
  }

  // Cryptographic signature is verified. Now safely parse and validate payload claims.
  try {
    const payloadStr = Buffer.from(b64Payload, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Session token has expired." };
    }

    if (!payload.sub || typeof payload.sub !== "string") {
      return { valid: false, error: "Session token missing required subject identifier." };
    }

    return {
      valid: true,
      user: {
        id: payload.sub,
        email: payload.email || `${payload.sub}@paypilot.local`,
        role: payload.role || "authenticated",
        business_id: payload.business_id || "biz_paypilot_demo_01",
      },
    };
  } catch {
    return { valid: false, error: "Failed to decode session payload." };
  }
}

/**
 * Extracts authentication credentials and identifies their transport source:
 * - `paypilot_session` cookie -> dedicated local demo credential (`source: "paypilot_session"`)
 * - `Authorization: Bearer <token>` or `sb-access-token` cookie -> Supabase credential (`source: "supabase"`)
 */
export function extractAuthCredential(req: NextRequest | Request): ExtractedCredential | null {
  // 1. Dedicated demo session cookie (paypilot_session)
  if ("cookies" in req && typeof (req as NextRequest).cookies?.get === "function") {
    const nextReq = req as NextRequest;
    const demoCookie = nextReq.cookies.get(SESSION_COOKIE_NAME);
    if (demoCookie?.value) {
      return { token: demoCookie.value, source: "paypilot_session" };
    }
  }

  // Cookie header fallback for standard Request object
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const matchDemo = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (matchDemo?.[1]) {
      return { token: decodeURIComponent(matchDemo[1]), source: "paypilot_session" };
    }
  }

  // 2. Authorization: Bearer <token> (Supabase access token or standard Bearer JWT)
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return { token, source: "supabase" };
    }
  }

  // 3. Supabase access token cookie (sb-access-token)
  if ("cookies" in req && typeof (req as NextRequest).cookies?.get === "function") {
    const nextReq = req as NextRequest;
    const sbCookie = nextReq.cookies.get("sb-access-token");
    if (sbCookie?.value) {
      return { token: sbCookie.value, source: "supabase" };
    }
  }

  if (cookieHeader) {
    const matchSb = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
    if (matchSb?.[1]) {
      return { token: decodeURIComponent(matchSb[1]), source: "supabase" };
    }
  }

  return null;
}

export function extractAuthToken(req: NextRequest | Request): string | null {
  const cred = extractAuthCredential(req);
  return cred ? cred.token : null;
}

/**
 * Verifies request session server-side with strict, deterministic provider routing:
 *
 * ROUTING CONTRACT:
 * 1. Tokens from the dedicated `paypilot_session` cookie are verified EXCLUSIVELY
 *    using the local HMAC verifier. They are NEVER sent to Supabase Auth.
 *    Permitted ONLY when BOTH `NODE_ENV !== "production"` AND `PAYPILOT_DEMO_AUTH === "true"`.
 * 2. Supabase access tokens (`sb-access-token`) and standard Bearer JWTs (`Authorization: Bearer`)
 *    are verified EXCLUSIVELY through Supabase Auth (`supabase.auth.getUser()`).
 *    If Supabase verification fails, returns HTTP 401 immediately with ZERO fallback to HMAC.
 */
export async function verifyRequestSession(
  req: NextRequest | Request
): Promise<SessionVerificationResult> {
  const credential = extractAuthCredential(req);

  if (!credential) {
    return {
      authenticated: false,
      error: "Authentication required. Missing bearer token or session cookie.",
      statusCode: 401,
    };
  }

  const { token, source } = credential;

  // ──────────────────────────────────────────────────────────────────────────
  // Branch A: Tokens from dedicated paypilot_session cookie
  // MUST be verified EXCLUSIVELY using the local HMAC verifier.
  // NEVER sent to Supabase Auth.
  // ──────────────────────────────────────────────────────────────────────────
  if (source === "paypilot_session") {
    const isDemoAllowed =
      process.env.NODE_ENV !== "production" &&
      process.env.PAYPILOT_DEMO_AUTH === "true";

    if (!isDemoAllowed) {
      return {
        authenticated: false,
        error: "Demo authentication is disabled in this environment.",
        statusCode: 401,
      };
    }

    const localResult = verifyLocalSessionToken(token);
    if (localResult.valid && localResult.user) {
      return {
        authenticated: true,
        user: localResult.user,
      };
    }

    return {
      authenticated: false,
      error: localResult.error || "Invalid or expired demo session token.",
      statusCode: 401,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Branch B: Supabase access tokens & standard Bearer JWTs
  // MUST be verified EXCLUSIVELY through supabase.auth.getUser(token).
  // NEVER falls back to local HMAC verification.
  // ──────────────────────────────────────────────────────────────────────────
  const supabase = testSupabaseClientOverride || getSupabaseAdminClient() || getSupabaseClient();
  if (!supabase) {
    return {
      authenticated: false,
      error: "Authentication unavailable. Supabase client is not configured.",
      statusCode: 401,
    };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return {
        authenticated: false,
        error: error?.message || "Invalid or expired Supabase authentication session.",
        statusCode: 401,
      };
    }
    return {
      authenticated: true,
      user: {
        id: data.user.id,
        email: data.user.email || data.user.id,
        role: data.user.role || "authenticated",
        business_id:
          (data.user.app_metadata?.business_id as string) ||
          (data.user.user_metadata?.business_id as string) ||
          "biz_paypilot_demo_01",
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Supabase Auth error";
    return {
      authenticated: false,
      error: `Supabase authentication error: ${msg}`,
      statusCode: 401,
    };
  }
}
