import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfigStatus } from "../../types/index.ts";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }

  // Prevent placeholder or invalid URLs from crashing
  if (url.includes("your-project.supabase.co") || key.includes("your-publishable")) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.warn("Failed to initialize Supabase client:", err);
      return null;
    }
  }

  return supabaseInstance;
}

export async function checkSupabaseConnection(): Promise<SupabaseConfigStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key || url.includes("your-project.supabase.co")) {
    return {
      state: "missing_env",
      message: "Supabase environment variables not configured. Running in local demo mode.",
      details: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local to link live Supabase.",
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      state: "connection_error",
      message: "Supabase client initialization failed.",
      details: "Please verify the format of NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  try {
    const { error } = await client
      .from("demo_businesses")
      .select("id")
      .limit(1);

    if (error) {
      return {
        state: "connection_error",
        message: "Failed to connect to Supabase database.",
        details: error.message,
      };
    }

    return {
      state: "connected",
      message: "Successfully connected to Supabase PostgreSQL database.",
      details: `Target: ${new URL(url).hostname}`,
    };
  } catch (err) {
    return {
      state: "connection_error",
      message: "Connection attempt to Supabase timed out or failed.",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}
