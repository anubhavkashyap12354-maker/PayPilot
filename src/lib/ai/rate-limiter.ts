interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const PRUNE_INTERVAL_MS = 60_000;
let lastPrune = Date.now();

function pruneExpiredEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Sliding-window rate limiter for server-side AI endpoints.
 * @param identifier Client IP address, user token, or session ID
 * @param limit Max allowed requests within window (default: 30)
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 min)
 */
export function checkRateLimit(
  identifier: string,
  limit = 30,
  windowMs = 60_000
): RateLimitResult {
  pruneExpiredEntries(windowMs);

  const now = Date.now();
  const entry = rateLimitStore.get(identifier) || { timestamps: [] };

  // Filter timestamps within current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  const oldestTimestamp = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
  const resetSeconds = Math.max(
    1,
    Math.ceil((oldestTimestamp + windowMs - now) / 1000)
  );

  if (entry.timestamps.length >= limit) {
    rateLimitStore.set(identifier, entry);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
    };
  }

  // Record this request
  entry.timestamps.push(now);
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - entry.timestamps.length),
    resetSeconds,
  };
}

/**
 * Reset rate limit store (used in testing)
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
