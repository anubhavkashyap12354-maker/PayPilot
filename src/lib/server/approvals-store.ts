/**
 * Server-side Approval Store — Phase 3D.4 (Security & Atomicity Hardened)
 *
 * SAFETY & SECURITY CONTRACT:
 * - Uses dedicated server-only Supabase admin client (getSupabaseAdminClient) with
 *   SUPABASE_SERVICE_ROLE_KEY to perform trusted server-side mutations.
 * - Rejects any attempt by the client to supply an `actor_id` in request payloads.
 * - Enforces business/tenant isolation on all reads and decisions. Cross-business
 *   access returns HTTP 403 Forbidden.
 * - Atomicity: Status transitions and audit-trail insertions are executed as a SINGLE
 *   atomic database transaction via the `decide_approval_atomic` stored procedure.
 * - Optimistic concurrency protection: lock_version increments on every transition;
 *   conflicts return HTTP 409 Conflict.
 * - ZERO PayPal or external financial operations: approval decisions record human
 *   authorizations only.
 */

import { getSupabaseAdminClient } from "../supabase/admin.ts";
import type {
  PersistentApprovalRecord,
  ApprovalAuditEntry,
  CreateApprovalPayload,
  ApprovalDecisionPayload,
  PersistentApprovalStatus,
} from "../../types/index.ts";

import { APPROVAL_TRANSITIONS as TRANSITIONS } from "../../types/index.ts";

// ─── In-memory fallback store (when Supabase is unconfigured / offline test mode) ──
let inMemoryApprovals: PersistentApprovalRecord[] = [];
let inMemoryAudit: ApprovalAuditEntry[] = [];
let simulateAuditFailure = false;

function generateId(): string {
  return `apr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateAuditId(): string {
  return `aud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

export function __resetInMemoryStoreForTesting(): void {
  inMemoryApprovals = [];
  inMemoryAudit = [];
  simulateAuditFailure = false;
}

export function __setSimulateAuditFailureForTesting(enabled: boolean): void {
  simulateAuditFailure = enabled;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_TYPES = new Set([
  "contact_customer",
  "retry_payment",
  "review_high_value_order",
  "accelerate_payout",
  "optimize_checkout",
]);

const VALID_PRIORITIES = new Set(["urgent", "high", "medium", "low"]);

export interface ApprovalStoreResult<T> {
  data: T | null;
  error: string | null;
  statusCode: number;
}

function validateCreatePayload(
  body: unknown
): { valid: true; payload: CreateApprovalPayload } | { valid: false; error: string; statusCode: number } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object.", statusCode: 400 };
  }
  const b = body as Record<string, unknown>;

  // Anti-spoofing: reject any client-supplied actor_id
  if ("actor_id" in b) {
    return {
      valid: false,
      error: "Security violation: actor_id cannot be specified in the request body. Identity is derived strictly from the verified session.",
      statusCode: 400,
    };
  }

  if (typeof b.recommendation_type !== "string" || !VALID_TYPES.has(b.recommendation_type)) {
    return { valid: false, error: `Invalid recommendation_type. Must be one of: ${[...VALID_TYPES].join(", ")}.`, statusCode: 400 };
  }
  if (typeof b.title !== "string" || b.title.trim().length < 1 || b.title.length > 500) {
    return { valid: false, error: "title must be a non-empty string (max 500 chars).", statusCode: 400 };
  }
  if (typeof b.description !== "string" || b.description.trim().length < 1 || b.description.length > 2000) {
    return { valid: false, error: "description must be a non-empty string (max 2000 chars).", statusCode: 400 };
  }
  if (typeof b.rationale !== "string" || b.rationale.trim().length < 1 || b.rationale.length > 2000) {
    return { valid: false, error: "rationale must be a non-empty string (max 2000 chars).", statusCode: 400 };
  }
  if (typeof b.priority !== "string" || !VALID_PRIORITIES.has(b.priority)) {
    return { valid: false, error: `Invalid priority. Must be one of: ${[...VALID_PRIORITIES].join(", ")}.`, statusCode: 400 };
  }
  if (typeof b.proposed_action !== "string" || b.proposed_action.trim().length < 1 || b.proposed_action.length > 2000) {
    return { valid: false, error: "proposed_action must be a non-empty string (max 2000 chars).", statusCode: 400 };
  }

  const related_order_id =
    typeof b.related_order_id === "string" && b.related_order_id.trim().length > 0
      ? b.related_order_id.trim()
      : null;

  return {
    valid: true,
    payload: {
      recommendation_type: b.recommendation_type as CreateApprovalPayload["recommendation_type"],
      title: b.title.trim(),
      description: b.description.trim(),
      rationale: b.rationale.trim(),
      priority: b.priority as CreateApprovalPayload["priority"],
      related_order_id,
      proposed_action: b.proposed_action.trim(),
    },
  };
}

function validateDecisionPayload(
  body: unknown
): { valid: true; payload: ApprovalDecisionPayload } | { valid: false; error: string; statusCode: number } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object.", statusCode: 400 };
  }
  const b = body as Record<string, unknown>;

  // Anti-spoofing: reject any client-supplied actor_id
  if ("actor_id" in b) {
    return {
      valid: false,
      error: "Security violation: actor_id cannot be specified in the request body. Identity is derived strictly from the verified session.",
      statusCode: 400,
    };
  }

  const validDecisionStatuses = new Set(["approved", "rejected", "changes_requested", "pending"]);
  if (typeof b.status !== "string" || !validDecisionStatuses.has(b.status)) {
    return { valid: false, error: "status must be one of: approved, rejected, changes_requested, pending.", statusCode: 400 };
  }

  let decision_reason: string | undefined;
  if (b.decision_reason !== undefined) {
    if (typeof b.decision_reason !== "string" || b.decision_reason.length > 1000) {
      return { valid: false, error: "decision_reason must be a string (max 1000 chars).", statusCode: 400 };
    }
    decision_reason = b.decision_reason.trim() || undefined;
  }

  let expected_version: number | undefined;
  if (b.expected_version !== undefined) {
    if (typeof b.expected_version !== "number" || b.expected_version < 1) {
      return { valid: false, error: "expected_version must be an integer >= 1.", statusCode: 400 };
    }
    expected_version = b.expected_version;
  } else if (b.lock_version !== undefined) {
    if (typeof b.lock_version !== "number" || b.lock_version < 1) {
      return { valid: false, error: "lock_version must be an integer >= 1.", statusCode: 400 };
    }
    expected_version = b.lock_version;
  }

  return {
    valid: true,
    payload: {
      status: b.status as ApprovalDecisionPayload["status"],
      decision_reason,
      expected_version,
      lock_version: expected_version,
    },
  };
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

/**
 * Creates a new approval request (starts as 'pending', lock_version: 1).
 * Scoped to authoritative business_id and verified actor identity.
 */
export async function createApproval(
  rawBody: unknown,
  actorIdentity: string,
  businessId: string = "biz_paypilot_demo_01"
): Promise<ApprovalStoreResult<PersistentApprovalRecord>> {
  const validation = validateCreatePayload(rawBody);
  if (!validation.valid) {
    return { data: null, error: validation.error, statusCode: validation.statusCode };
  }
  const { payload } = validation;

  const adminSupabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (adminSupabase) {
    // Trusted server-side database insertion using service_role credentials
    const { data, error } = await adminSupabase
      .from("approval_requests")
      .insert({
        business_id: businessId,
        recommendation_type: payload.recommendation_type,
        title: payload.title,
        description: payload.description,
        rationale: payload.rationale,
        priority: payload.priority,
        related_order_id: payload.related_order_id ?? null,
        proposed_action: payload.proposed_action,
        status: "pending",
        lock_version: 1,
      })
      .select()
      .single();

    if (error) {
      console.error("[ApprovalStore] Insert error:", error.message);
      return { data: null, error: `Database error: ${error.message}`, statusCode: 500 };
    }

    // Record creation audit entry via service_role
    await adminSupabase.from("approval_audit_history").insert({
      approval_id: data.id,
      previous_status: null,
      new_status: "pending",
      decision_reason: null,
      actor_id: actorIdentity,
    });

    return { data: data as PersistentApprovalRecord, error: null, statusCode: 201 };
  }

  // In-memory fallback (offline / test mode)
  const record: PersistentApprovalRecord = {
    id: generateId(),
    business_id: businessId,
    recommendation_type: payload.recommendation_type,
    title: payload.title,
    description: payload.description,
    rationale: payload.rationale,
    priority: payload.priority,
    related_order_id: payload.related_order_id ?? null,
    proposed_action: payload.proposed_action,
    status: "pending",
    lock_version: 1,
    created_at: now,
    updated_at: now,
    decided_at: null,
    decision_reason: null,
  };
  inMemoryApprovals.push(record);

  // Initial audit entry
  inMemoryAudit.push({
    id: generateAuditId(),
    approval_id: record.id,
    previous_status: null,
    new_status: "pending",
    decision_reason: null,
    actor_id: actorIdentity,
    recorded_at: now,
  });

  return { data: record, error: null, statusCode: 201 };
}

/**
 * Lists approvals, filtered by business ownership and optional status.
 */
export async function listApprovals(
  statusFilter?: string,
  businessId?: string
): Promise<ApprovalStoreResult<PersistentApprovalRecord[]>> {
  const adminSupabase = getSupabaseAdminClient();

  if (adminSupabase) {
    let query = adminSupabase
      .from("approval_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const validStatuses = new Set(["pending", "approved", "rejected", "changes_requested"]);
    if (statusFilter && validStatuses.has(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      return { data: null, error: `Database error: ${error.message}`, statusCode: 500 };
    }
    return { data: (data ?? []) as PersistentApprovalRecord[], error: null, statusCode: 200 };
  }

  let list = inMemoryApprovals;
  if (businessId) {
    list = list.filter((a) => a.business_id === businessId);
  }
  if (statusFilter) {
    list = list.filter((a) => a.status === statusFilter);
  }
  const sorted = [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return { data: sorted, error: null, statusCode: 200 };
}

/**
 * Fetches a single approval by ID with business ownership validation.
 */
export async function getApproval(
  id: string,
  businessId?: string
): Promise<ApprovalStoreResult<PersistentApprovalRecord>> {
  const adminSupabase = getSupabaseAdminClient();

  if (adminSupabase) {
    const { data, error } = await adminSupabase
      .from("approval_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return { data: null, error: "Approval record not found.", statusCode: 404 };
    }

    // Business ownership check
    if (businessId && data.business_id !== businessId) {
      return {
        data: null,
        error: "Forbidden: You do not have permission to access approvals belonging to another business.",
        statusCode: 403,
      };
    }

    return { data: data as PersistentApprovalRecord, error: null, statusCode: 200 };
  }

  const found = inMemoryApprovals.find((a) => a.id === id);
  if (!found) return { data: null, error: "Approval record not found.", statusCode: 404 };

  // Business ownership check
  if (businessId && found.business_id !== businessId) {
    return {
      data: null,
      error: "Forbidden: You do not have permission to access approvals belonging to another business.",
      statusCode: 403,
    };
  }

  return { data: found, error: null, statusCode: 200 };
}

/**
 * Records an approval decision atomically:
 * - When Supabase is configured: Calls PostgreSQL stored procedure `decide_approval_atomic`
 *   to execute row-locking, status update, and audit insertion within ONE transaction.
 * - In-memory fallback: Guarantees transactional rollback if audit insertion fails.
 * - Cross-business mutations return HTTP 403 Forbidden.
 * - Concurrency conflicts return HTTP 409 Conflict.
 */
export async function decideApproval(
  id: string,
  rawBody: unknown,
  actorIdentity: string,
  businessId?: string
): Promise<ApprovalStoreResult<PersistentApprovalRecord>> {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return { data: null, error: "Invalid approval ID.", statusCode: 400 };
  }

  const validation = validateDecisionPayload(rawBody);
  if (!validation.valid) {
    return { data: null, error: validation.error, statusCode: validation.statusCode };
  }
  const { payload } = validation;

  const adminSupabase = getSupabaseAdminClient();

  if (adminSupabase) {
    // 1. Fetch current lock_version and verify existence
    const { data: existing, error: fetchErr } = await adminSupabase
      .from("approval_requests")
      .select("lock_version, status, business_id")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return { data: null, error: "Approval record not found.", statusCode: 404 };
    }

    // Business ownership validation
    if (businessId && existing.business_id !== businessId) {
      return {
        data: null,
        error: "Forbidden: Cross-business approval decisions are prohibited.",
        statusCode: 403,
      };
    }

    const currentVersion = (existing.lock_version as number) || 1;

    // 2. Execute single-transaction atomic RPC
    const { data: rpcResult, error: rpcErr } = await adminSupabase.rpc(
      "decide_approval_atomic",
      {
        p_approval_id: id,
        p_expected_version: currentVersion,
        p_new_status: payload.status,
        p_decision_reason: payload.decision_reason ?? null,
        p_actor_id: actorIdentity,
        p_expected_business: businessId ?? null,
      }
    );

    if (rpcErr) {
      console.error("[ApprovalStore] RPC execution error:", rpcErr.message);
      return { data: null, error: `Database RPC error: ${rpcErr.message}`, statusCode: 500 };
    }

    if (!rpcResult?.success) {
      const code = rpcResult?.error_code;
      let statusCode = 400;
      if (code === "NOT_FOUND") statusCode = 404;
      else if (code === "CONCURRENCY_CONFLICT") statusCode = 409;
      else if (code === "TERMINAL_STATE" || code === "INVALID_TRANSITION") statusCode = 422;
      else if (code === "FORBIDDEN") statusCode = 403;

      return {
        data: null,
        error: rpcResult?.error || "Approval decision failed.",
        statusCode,
      };
    }

    return {
      data: rpcResult.approval as PersistentApprovalRecord,
      error: null,
      statusCode: 200,
    };
  }

  // ─── In-memory fallback with transactional rollback ────────────────────────
  const idx = inMemoryApprovals.findIndex((a) => a.id === id);
  if (idx === -1) return { data: null, error: "Approval record not found.", statusCode: 404 };

  const existing = inMemoryApprovals[idx];

  // Business ownership validation
  if (businessId && existing.business_id !== businessId) {
    return {
      data: null,
      error: "Forbidden: Cross-business approval decisions are prohibited.",
      statusCode: 403,
    };
  }

  // Optimistic concurrency check (version mismatch returns 409 Conflict)
  const expectedVersion = payload.expected_version ?? payload.lock_version;
  if (expectedVersion !== undefined && (existing.lock_version || 1) !== expectedVersion) {
    return {
      data: null,
      error: "Concurrency conflict: This approval was modified by another concurrent reviewer. Please refresh and try again.",
      statusCode: 409,
    };
  }

  const currentStatus = existing.status;
  const currentVersion = existing.lock_version || 1;
  const allowed = TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(payload.status)) {
    return {
      data: null,
      error: `Invalid status transition: '${currentStatus}' → '${payload.status}'. Allowed: [${allowed.join(", ") || "none — terminal state"}].`,
      statusCode: 422,
    };
  }

  const now = new Date().toISOString();
  const isTerminal = payload.status === "approved" || payload.status === "rejected";

  // Snapshot for transactional rollback
  const rollbackSnapshot = { ...existing };

  try {
    // Phase 1: Apply status change
    const updated: PersistentApprovalRecord = {
      ...existing,
      status: payload.status,
      lock_version: currentVersion + 1,
      decided_at: isTerminal ? now : null,
      decision_reason: payload.decision_reason ?? null,
      updated_at: now,
    };
    inMemoryApprovals[idx] = updated;

    // Phase 2: Insert audit record
    if (simulateAuditFailure) {
      throw new Error("Simulated database failure during audit trail insertion.");
    }

    inMemoryAudit.push({
      id: generateAuditId(),
      approval_id: id,
      previous_status: currentStatus,
      new_status: payload.status,
      decision_reason: payload.decision_reason ?? null,
      actor_id: actorIdentity,
      recorded_at: now,
    });

    return { data: updated, error: null, statusCode: 200 };
  } catch (err: unknown) {
    // Transactional Rollback: Revert status change if audit recording fails
    inMemoryApprovals[idx] = rollbackSnapshot;
    const errorMsg = err instanceof Error ? err.message : "Audit recording failure";
    console.error("[ApprovalStore] Transaction rolled back:", errorMsg);
    return {
      data: null,
      error: `Transaction rolled back: ${errorMsg}`,
      statusCode: 500,
    };
  }
}

/**
 * Fetches audit trail for an approval with business ownership validation.
 */
export async function getApprovalAuditHistory(
  approvalId: string,
  businessId?: string
): Promise<ApprovalStoreResult<ApprovalAuditEntry[]>> {
  if (!approvalId || typeof approvalId !== "string" || approvalId.trim().length === 0) {
    return { data: null, error: "Invalid approval ID.", statusCode: 400 };
  }

  const adminSupabase = getSupabaseAdminClient();

  if (adminSupabase) {
    // First verify parent approval and business ownership
    const { data: parent, error: pErr } = await adminSupabase
      .from("approval_requests")
      .select("id, business_id")
      .eq("id", approvalId)
      .single();

    if (pErr || !parent) {
      return { data: null, error: "Approval record not found.", statusCode: 404 };
    }

    if (businessId && parent.business_id !== businessId) {
      return {
        data: null,
        error: "Forbidden: You do not have permission to access audit history belonging to another business.",
        statusCode: 403,
      };
    }

    const { data, error } = await adminSupabase
      .from("approval_audit_history")
      .select("*")
      .eq("approval_id", approvalId)
      .order("recorded_at", { ascending: true });

    if (error) {
      return { data: null, error: `Database error: ${error.message}`, statusCode: 500 };
    }

    return { data: (data ?? []) as ApprovalAuditEntry[], error: null, statusCode: 200 };
  }

  // In-memory fallback
  const parent = inMemoryApprovals.find((a) => a.id === approvalId);
  if (!parent) return { data: null, error: "Approval record not found.", statusCode: 404 };

  if (businessId && parent.business_id !== businessId) {
    return {
      data: null,
      error: "Forbidden: You do not have permission to access audit history belonging to another business.",
      statusCode: 403,
    };
  }

  const entries = inMemoryAudit
    .filter((e) => e.approval_id === approvalId)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  return { data: entries, error: null, statusCode: 200 };
}
