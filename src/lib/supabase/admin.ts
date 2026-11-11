/**
 * Dedicated Server-Side Supabase Admin Client
 *
 * SECURITY CONTRACT:
 * - This file is strictly SERVER-ONLY. It MUST NEVER be imported into or executed
 *   within client-side React components or browser bundles.
 * - Uses SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security for authoritative
 *   server-managed tables (e.g. approval records and audit ledgers).
 * - Never expose SUPABASE_SERVICE_ROLE_KEY via NEXT_PUBLIC_* variables.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Client-side execution guard
if (typeof window !== "undefined") {
  throw new Error(
    "FATAL SECURITY VIOLATION: @/lib/supabase/admin was imported into a client-side environment. " +
    "Supabase Service Role credentials can only be used within trusted server environments."
  );
}

let adminInstance: SupabaseClient | null = null;

/**
 * Validates whether required Supabase admin environment variables are configured.
 */
export function isSupabaseAdminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return false;
  if (url.includes("your-project.supabase.co") || key.includes("your-supabase-service-role-key")) {
    return false;
  }
  return true;
}

/**
 * Obtains the singleton Supabase admin client using SUPABASE_SERVICE_ROLE_KEY.
 * Returns null if the required environment variables are missing or unconfigured.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!adminInstance) {
    try {
      adminInstance = createClient(url, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error("[Supabase Admin] Failed to initialize admin client:", err);
      return null;
    }
  }

  return adminInstance;
}
