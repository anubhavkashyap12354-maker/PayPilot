export type PaymentStatus = "completed" | "pending" | "failed" | "refunded";
export type OrderStatus = "fulfilled" | "processing" | "pending" | "cancelled" | "refunded";
export type ApprovalStatus = "pending" | "approved" | "rejected";

// ─── Phase 3D: Persistent Approval Types ─────────────────────────────────────

export type PersistentApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

export type ApprovalRecommendationType =
  | "contact_customer"
  | "retry_payment"
  | "review_high_value_order"
  | "accelerate_payout"
  | "optimize_checkout";

export type ApprovalPriority = "urgent" | "high" | "medium" | "low";

export interface PersistentApprovalRecord {
  id: string;
  business_id: string;
  recommendation_type: ApprovalRecommendationType;
  title: string;
  description: string;
  rationale: string;
  priority: ApprovalPriority;
  related_order_id: string | null;
  proposed_action: string;
  status: PersistentApprovalStatus;
  lock_version: number;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
  decision_reason: string | null;
}

export interface ApprovalAuditEntry {
  id: string;
  approval_id: string;
  previous_status: PersistentApprovalStatus | null;
  new_status: PersistentApprovalStatus;
  decision_reason: string | null;
  actor_id: string;
  recorded_at: string;
}

export interface CreateApprovalPayload {
  business_id?: string;
  recommendation_type: ApprovalRecommendationType;
  title: string;
  description: string;
  rationale: string;
  priority: ApprovalPriority;
  related_order_id?: string | null;
  proposed_action: string;
}

export interface ApprovalDecisionPayload {
  status: "approved" | "rejected" | "changes_requested" | "pending";
  decision_reason?: string;
  expected_version?: number;
  lock_version?: number;
}

/** Valid approval status transitions (from → allowed tos) */
export const APPROVAL_TRANSITIONS: Record<
  PersistentApprovalStatus,
  PersistentApprovalStatus[]
> = {
  pending: ["approved", "rejected", "changes_requested"],
  changes_requested: ["pending", "approved", "rejected"],
  approved: [],   // terminal
  rejected: [],   // terminal
};

export interface Business {
  id: string;
  name: string;
  legalName: string;
  currency: string;
  timezone: string;
  status: "active" | "trial" | "restricted";
  createdAt: string;
}

export interface Transaction {
  id: string;
  businessId: string;
  orderId?: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: "paypal" | "card" | "bank_transfer" | "apple_pay";
  fee: number;
  netAmount: number;
  timestamp: string;
  description: string;
  cardBrand?: string;
  cardLast4?: string;
}

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  trackingNumber?: string;
  transactionId?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: "paypal_checkout" | "direct_debit" | "card_processor";
  gatewayReference: string;
  initiatedAt: string;
  settledAt?: string;
  updatedAt?: string;
  errorMessage?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
}

export interface Activity {
  id: string;
  type: "payment_received" | "order_created" | "payment_failed" | "approval_requested" | "payout_processed";
  title: string;
  description: string;
  timestamp: string;
  amount?: number;
  status?: "success" | "warning" | "error" | "info";
  relatedId?: string;
}

export interface BusinessInsight {
  id: string;
  category: "revenue" | "risk" | "operations" | "cash_flow";
  title: string;
  summary: string;
  detailedAnalysis: string;
  metricChange?: string;
  trend: "positive" | "negative" | "neutral";
  confidenceScore: number;
  suggestedAction: string;
  actionUrl?: string;
  generatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  requestedBy: string;
  requestType: "high_value_refund" | "vendor_disbursement" | "batch_payout" | "dispute_settlement";
  amount: number;
  currency: string;
  recipient: string;
  status: ApprovalStatus;
  urgency: "urgent" | "standard" | "low";
  reason: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface DailyRevenue {
  date: string;
  formattedDate: string;
  revenue: number;
  orders: number;
  previousWeekRevenue: number;
}

export interface KPIMetrics {
  totalRevenue: number;
  successfulPayments: number;
  pendingOrders: number;
  failedPayments: number;
  revenueGrowth: number;
  successRate: number;
  pendingAmount: number;
}

export interface SupabaseConfigStatus {
  state: "connected" | "missing_env" | "connection_error";
  message: string;
  details?: string;
}

export type PayPalConnectionState =
  | "not_configured"
  | "configured"
  | "connection_successful"
  | "connection_failed";

export interface PayPalConfigStatus {
  state: PayPalConnectionState;
  environment: "sandbox" | "production";
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  message: string;
  details?: string;
}

export interface CreatePayPalOrderResponse {
  success: boolean;
  orderId: string;
  paypalOrderId: string;
  approvalUrl: string;
  status: string;
  isMockSandbox?: boolean;
}

export interface CapturePayPalOrderResponse {
  success: boolean;
  orderId: string;
  paypalOrderId: string;
  paypalCaptureId: string;
  status: "COMPLETED" | "PENDING" | "FAILED";
  amount: number;
  currency: string;
  transactionId: string;
  isMockSandbox?: boolean;
}

export interface VerifyWebhookSignatureParams {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookId: string;
  webhookEvent: Record<string, unknown>;
}

export interface WebhookEventRecord {
  id: string;
  eventId: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  summary?: string;
  status: "received" | "processing" | "processed" | "ignored" | "failed";
  payload: Record<string, unknown>;
  receivedAt: string;
  processedAt?: string;
  errorMessage?: string;
}
