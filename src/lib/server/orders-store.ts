import type {
  Order,
  Payment,
  Transaction,
  OrderStatus,
  PaymentStatus,
  WebhookEventRecord,
} from "../../types/index.ts";
import { DEMO_ORDERS, DEMO_PAYMENTS, DEMO_TRANSACTIONS } from "../demo-data.ts";
import { getSupabaseClient } from "../supabase/client.ts";

// In-memory server-side fallback state
class ServerOrdersStore {
  private orders: Map<string, Order> = new Map();
  private payments: Map<string, Payment> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private paypalOrderMapping: Map<string, string> = new Map(); // paypalOrderId -> internal orderId
  private webhookEvents: Map<string, WebhookEventRecord> = new Map(); // eventId -> record
  private inFlightEvents: Set<string> = new Set(); // Concurrency locking for active deliveries

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    DEMO_ORDERS.forEach((ord) => {
      this.orders.set(ord.id, { ...ord });
      // Also map by orderNumber for flexible lookup
      this.orders.set(ord.orderNumber, { ...ord });
    });

    DEMO_PAYMENTS.forEach((pay) => {
      this.payments.set(pay.id, { ...pay });
    });

    DEMO_TRANSACTIONS.forEach((txn) => {
      this.transactions.set(txn.id, { ...txn });
    });
  }

  async getOrder(orderIdOrNumber: string): Promise<Order | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("demo_orders")
          .select("*")
          .or(`id.eq.${orderIdOrNumber},order_number.eq.${orderIdOrNumber}`)
          .maybeSingle();

        if (data && !error) {
          return {
            id: data.id,
            orderNumber: data.order_number,
            customerName: data.customer_name,
            customerEmail: data.customer_email,
            shippingAddress: data.shipping_address,
            items: data.items || [],
            totalAmount: Number(data.total_amount),
            currency: data.currency,
            status: data.status as OrderStatus,
            createdAt: data.created_at,
            trackingNumber: data.tracking_number,
            paypalOrderId: data.paypal_order_id,
            paypalCaptureId: data.paypal_capture_id,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn("Supabase order lookup failed, falling back to local memory store:", err);
      }
    }

    return this.orders.get(orderIdOrNumber) || null;
  }

  async getOrderByPayPalOrderId(paypalOrderId: string): Promise<Order | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("demo_orders")
          .select("*")
          .eq("paypal_order_id", paypalOrderId)
          .maybeSingle();

        if (data && !error) {
          return {
            id: data.id,
            orderNumber: data.order_number,
            customerName: data.customer_name,
            customerEmail: data.customer_email,
            shippingAddress: data.shipping_address,
            items: data.items || [],
            totalAmount: Number(data.total_amount),
            currency: data.currency,
            status: data.status as OrderStatus,
            createdAt: data.created_at,
            trackingNumber: data.tracking_number,
            paypalOrderId: data.paypal_order_id,
            paypalCaptureId: data.paypal_capture_id,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn("Supabase lookup by paypal_order_id failed:", err);
      }
    }

    const internalId = this.paypalOrderMapping.get(paypalOrderId);
    if (internalId) {
      return this.orders.get(internalId) || null;
    }

    // Direct scan in memory
    for (const order of this.orders.values()) {
      if (order.paypalOrderId === paypalOrderId) {
        return order;
      }
    }

    return null;
  }

  async linkPayPalOrder(orderId: string, paypalOrderId: string): Promise<boolean> {
    const order = await this.getOrder(orderId);
    if (!order) return false;

    const now = new Date().toISOString();
    order.paypalOrderId = paypalOrderId;
    order.updatedAt = now;

    // Save in memory
    this.orders.set(order.id, order);
    this.orders.set(order.orderNumber, order);
    this.paypalOrderMapping.set(paypalOrderId, order.id);

    // Save in Supabase if linked
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from("demo_orders")
          .update({
            paypal_order_id: paypalOrderId,
            updated_at: now,
          })
          .or(`id.eq.${order.id},order_number.eq.${order.orderNumber}`);
      } catch (err) {
        console.warn("Supabase update for paypal_order_id failed:", err);
      }
    }

    return true;
  }

  async completeOrderPayment(
    orderId: string,
    paypalOrderId: string,
    paypalCaptureId: string,
    verifiedAmount?: number,
    orderStatus: OrderStatus = "processing"
  ): Promise<{ order: Order; payment: Payment; transaction: Transaction } | null> {
    const order = await this.getOrder(orderId);
    if (!order) return null;

    // ── Idempotency guard: prevent duplicate payment mutations ───────────────
    // If this exact capture has already been recorded (same captureId),
    // reconstruct the existing records from local state and return them
    // without creating new ledger entries. This handles:
    //   • Concurrent webhook + direct capture both calling this method
    //   • PayPal re-delivering a PAYMENT.CAPTURE.COMPLETED webhook
    if (order.paypalCaptureId && order.paypalCaptureId === paypalCaptureId) {
      // Find the existing payment record for this capture
      let existingPayment: Payment | undefined;
      for (const p of this.payments.values()) {
        if (p.paypalCaptureId === paypalCaptureId) {
          existingPayment = p;
          break;
        }
      }
      // Find the existing transaction record
      let existingTransaction: Transaction | undefined;
      if (order.transactionId) {
        existingTransaction = this.transactions.get(order.transactionId);
      }

      if (existingPayment && existingTransaction) {
        return { order, payment: existingPayment, transaction: existingTransaction };
      }
      // If records are inconsistent (partial write), fall through and re-write them
    }

    const now = new Date().toISOString();
    const finalAmount = verifiedAmount !== undefined ? verifiedAmount : order.totalAmount;
    const fee = Number((finalAmount * 0.029 + 0.3).toFixed(2)); // Standard PayPal merchant fee model
    const netAmount = Number((finalAmount - fee).toFixed(2));
    const newTxnId = `TXN-PP-${Date.now().toString().slice(-5)}`;

    // 1. Update Order status to paid/processing (Separate from physical fulfillment)
    order.status = orderStatus;
    order.paypalOrderId = paypalOrderId;
    order.paypalCaptureId = paypalCaptureId;
    order.transactionId = newTxnId;
    order.updatedAt = now;

    this.orders.set(order.id, order);
    this.orders.set(order.orderNumber, order);

    // 2. Create/Update Payment record
    const payment: Payment = {
      id: `pay_pp_${Date.now().toString().slice(-4)}`,
      transactionId: newTxnId,
      amount: finalAmount,
      currency: order.currency,
      status: "completed",
      gateway: "paypal_checkout",
      gatewayReference: paypalCaptureId,
      paypalOrderId,
      paypalCaptureId,
      initiatedAt: order.createdAt,
      settledAt: now,
      updatedAt: now,
    };
    this.payments.set(payment.id, payment);

    // 3. Create Transaction Ledger entry
    const transaction: Transaction = {
      id: newTxnId,
      businessId: "biz_paypilot_demo_01",
      orderId: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      amount: finalAmount,
      currency: order.currency,
      status: "completed",
      paymentMethod: "paypal",
      fee,
      netAmount,
      timestamp: now,
      description: `PayPal Sandbox Payment for Order ${order.orderNumber}`,
    };
    this.transactions.set(transaction.id, transaction);

    // 4. Mirror to Supabase if connected
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from("demo_orders")
          .update({
            status: orderStatus,
            paypal_order_id: paypalOrderId,
            paypal_capture_id: paypalCaptureId,
            updated_at: now,
          })
          .or(`id.eq.${order.id},order_number.eq.${order.orderNumber}`);

        await supabase.from("demo_payments").insert({
          id: payment.id,
          business_id: "biz_paypilot_demo_01",
          order_id: order.id,
          amount: finalAmount,
          currency: order.currency,
          status: "completed",
          payment_method: "paypal",
          gateway: "paypal_checkout",
          gateway_reference: paypalCaptureId,
          fee,
          net_amount: netAmount,
          customer_name: order.customerName,
          customer_email: order.customerEmail,
          description: transaction.description,
          initiated_at: order.createdAt,
          settled_at: now,
        });
      } catch (err) {
        console.warn("Supabase persistence for completed payment failed:", err);
      }
    }

    return { order, payment, transaction };
  }

  async fulfillOrder(orderId: string, trackingNumber?: string): Promise<Order | null> {
    const order = await this.getOrder(orderId);
    if (!order) return null;

    const now = new Date().toISOString();
    order.status = "fulfilled";
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    } else if (!order.trackingNumber) {
      order.trackingNumber = `PP-TRK-${Date.now().toString().slice(-7)}`;
    }
    order.updatedAt = now;

    this.orders.set(order.id, order);
    this.orders.set(order.orderNumber, order);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from("demo_orders")
          .update({
            status: "fulfilled",
            tracking_number: order.trackingNumber,
            updated_at: now,
          })
          .or(`id.eq.${order.id},order_number.eq.${order.orderNumber}`);
      } catch (err) {
        console.warn("Supabase fulfillOrder update error:", err);
      }
    }

    return order;
  }

  async findMatchingOrder(resource: Record<string, unknown>): Promise<Order | null> {
    // 1. Check custom_id on resource (e.g. ord_003)
    if (typeof resource.custom_id === "string") {
      const order = await this.getOrder(resource.custom_id);
      if (order) return order;
    }

    // 2. Check supplementary_data related_ids
    const supp = resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined;
    if (supp?.related_ids?.order_id) {
      const order = await this.getOrderByPayPalOrderId(supp.related_ids.order_id);
      if (order) return order;
    }

    // 3. Check invoice_id
    if (typeof resource.invoice_id === "string") {
      const order = await this.getOrder(resource.invoice_id);
      if (order) return order;
    }

    // 4. Check capture ID if matching order has it stored
    if (typeof resource.id === "string") {
      for (const order of this.orders.values()) {
        if (order.paypalCaptureId === resource.id || order.paypalOrderId === resource.id) {
          return order;
        }
      }
    }

    return null;
  }

  async processWebhookEvent(
    event: Record<string, unknown>
  ): Promise<{
    status: "processed" | "ignored" | "duplicate" | "failed";
    message: string;
    orderId?: string;
  }> {
    const eventId = String(event.id || "");
    const eventType = String(event.event_type || "");
    const resource = (event.resource as Record<string, unknown>) || {};
    const now = new Date().toISOString();

    if (!eventId) {
      return { status: "failed", message: "Missing event ID in webhook payload." };
    }

    // 1. Concurrency guard: Prevent concurrent duplicate deliveries
    if (this.inFlightEvents.has(eventId)) {
      return {
        status: "duplicate",
        message: `Webhook event '${eventId}' is currently in-flight across workers.`,
      };
    }

    // 2. Idempotency Check: Allow retry if previously failed, reject if already processed or ignored
    const existingInMemory = this.webhookEvents.get(eventId);
    if (existingInMemory) {
      if (existingInMemory.status === "processed" || existingInMemory.status === "ignored") {
        return {
          status: "duplicate",
          message: `Webhook event '${eventId}' was already recorded in the event ledger.`,
        };
      }
      // If previous status was 'failed', allow execution to retry safely
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      // ── Database-backed atomic event claiming ────────────────────────────────
      // We use the UNIQUE constraint on event_id as a cross-process mutex.
      // Strategy: attempt an INSERT with status='processing'. If the event already
      // exists (unique_violation code 23505), read the existing record's status:
      //   • processing / processed / ignored → reject as duplicate
      //   • failed                           → allow retry (safe re-entry)
      //
      // This protects against concurrent deliveries across multiple Node.js
      // workers, Vercel serverless functions, or any multi-process deployment —
      // scenarios where the in-memory inFlightEvents Set cannot help.
      const claimRecord = {
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        event_id: eventId,
        event_type: eventType,
        resource_type: String(event.resource_type || ""),
        resource_id: String((event.resource as Record<string, unknown>)?.id || ""),
        summary: String(event.summary || ""),
        status: "processing",
        payload: event,
        claimed_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
      };

      try {
        const { error: insertError } = await supabase
          .from("paypal_webhook_events")
          .insert(claimRecord);

        if (insertError) {
          if (insertError.code === "23505") {
            // Unique constraint violation — event was already claimed by another worker
            const { data: existing } = await supabase
              .from("paypal_webhook_events")
              .select("status")
              .eq("event_id", eventId)
              .maybeSingle();

            if (!existing || existing.status === "failed") {
              // A previous attempt failed; allow retry by falling through
              // We'll rely on the in-memory check below for in-process dedup
            } else {
              // Event is processing, processed, or ignored — reject as duplicate
              return {
                status: "duplicate",
                message: `Webhook event '${eventId}' already claimed in Supabase event ledger (status: ${existing.status}).`,
              };
            }
          } else {
            console.warn("Supabase webhook event claim INSERT error:", insertError.message);
            // Non-unique error: fall through to in-memory processing
          }
        }
        // INSERT succeeded → this worker has exclusively claimed the event
      } catch (err) {
        console.warn("Supabase webhook atomic claim error:", err);
        // DB unavailable; fall through to in-memory concurrency guard
      }
    }

    // ── In-memory concurrency guard (single-process fallback) ────────────────
    // Protects within one Node.js process when Supabase is unavailable.
    // Lock event in-flight
    this.inFlightEvents.add(eventId);

    // Initialize webhook audit record
    const eventRecord: WebhookEventRecord = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventId,
      eventType,
      resourceType: String(event.resource_type || ""),
      resourceId: String(resource.id || ""),
      summary: String(event.summary || ""),
      status: "received",
      payload: event,
      receivedAt: now,
    };

    // 3. Identify corresponding PayPilot Order
    const order = await this.findMatchingOrder(resource);

    // 4. Dispatch to appropriate event handlers
    try {
      switch (eventType) {
        case "PAYMENT.CAPTURE.COMPLETED": {
          if (!order) {
            eventRecord.status = "ignored";
            eventRecord.errorMessage = "Event valid but could not be matched to an existing PayPilot order.";
            eventRecord.processedAt = now;
            await this.saveWebhookEvent(eventRecord);
            return {
              status: "ignored",
              message: "Capture completed event ignored: no matching PayPilot order found.",
            };
          }

          const captureId = String(resource.id || `CAP-${Date.now()}`);
          const supp = resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined;
          const paypalOrderId = supp?.related_ids?.order_id || order.paypalOrderId || captureId;
          const amountObj = resource.amount as { value?: string } | undefined;
          const verifiedAmount = amountObj?.value ? Number(amountObj.value) : order.totalAmount;

          // Transition order status to paid/processing (NOT automatically fulfilled)
          await this.completeOrderPayment(order.id, paypalOrderId, captureId, verifiedAmount, "processing");

          eventRecord.status = "processed";
          eventRecord.processedAt = new Date().toISOString();
          await this.saveWebhookEvent(eventRecord);

          return {
            status: "processed",
            message: `Successfully captured order ${order.orderNumber} via webhook (status: processing).`,
            orderId: order.id,
          };
        }

        case "PAYMENT.CAPTURE.PENDING": {
          if (!order) {
            eventRecord.status = "ignored";
            eventRecord.processedAt = now;
            await this.saveWebhookEvent(eventRecord);
            return { status: "ignored", message: "Pending capture ignored: unknown order." };
          }

          order.status = "pending";
          order.updatedAt = now;
          this.orders.set(order.id, order);

          eventRecord.status = "processed";
          eventRecord.processedAt = now;
          await this.saveWebhookEvent(eventRecord);

          return {
            status: "processed",
            message: `Recorded pending capture state for order ${order.orderNumber}.`,
            orderId: order.id,
          };
        }

        case "PAYMENT.CAPTURE.DENIED": {
          if (!order) {
            eventRecord.status = "ignored";
            eventRecord.processedAt = now;
            await this.saveWebhookEvent(eventRecord);
            return { status: "ignored", message: "Denied capture ignored: unknown order." };
          }

          order.status = "cancelled";
          order.updatedAt = now;
          this.orders.set(order.id, order);

          // Update payment record to failed
          for (const payment of this.payments.values()) {
            if (payment.paypalOrderId === order.paypalOrderId) {
              payment.status = "failed";
              payment.errorMessage = "Payment capture denied by buyer bank or PayPal security.";
              payment.updatedAt = now;
            }
          }

          eventRecord.status = "processed";
          eventRecord.processedAt = now;
          await this.saveWebhookEvent(eventRecord);

          return {
            status: "processed",
            message: `Recorded payment denial for order ${order.orderNumber}.`,
            orderId: order.id,
          };
        }

        case "PAYMENT.CAPTURE.REFUNDED": {
          if (!order) {
            eventRecord.status = "ignored";
            eventRecord.processedAt = now;
            await this.saveWebhookEvent(eventRecord);
            return { status: "ignored", message: "Refund event ignored: unknown order." };
          }

          order.status = "refunded";
          order.updatedAt = now;
          this.orders.set(order.id, order);

          for (const payment of this.payments.values()) {
            if (payment.paypalOrderId === order.paypalOrderId || payment.paypalCaptureId === resource.id) {
              payment.status = "refunded";
              payment.updatedAt = now;
            }
          }

          eventRecord.status = "processed";
          eventRecord.processedAt = now;
          await this.saveWebhookEvent(eventRecord);

          return {
            status: "processed",
            message: `Recorded refund for order ${order.orderNumber}.`,
            orderId: order.id,
          };
        }

        default: {
          eventRecord.status = "ignored";
          eventRecord.processedAt = now;
          eventRecord.summary = `Ignored event type: ${eventType}`;
          await this.saveWebhookEvent(eventRecord);

          return {
            status: "ignored",
            message: `Webhook event '${eventType}' is not in the scope of payment status synchronization.`,
          };
        }
      }
    } catch (err) {
      eventRecord.status = "failed";
      eventRecord.errorMessage = err instanceof Error ? err.message : String(err);
      eventRecord.processedAt = new Date().toISOString();
      await this.saveWebhookEvent(eventRecord);
      return {
        status: "failed",
        message: `Webhook processing error: ${eventRecord.errorMessage}`,
      };
    } finally {
      this.inFlightEvents.delete(eventId);
    }
  }

  async saveWebhookEvent(record: WebhookEventRecord): Promise<void> {
    this.webhookEvents.set(record.eventId, record);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // When processWebhookEvent used DB-backed atomic claiming, the row was
        // already INSERTed with status='processing'. We UPDATE it here to the
        // final status (processed / ignored / failed) using UPSERT (upsert=true)
        // so this call is safe regardless of whether the row already exists.
        await supabase.from("paypal_webhook_events").upsert(
          {
            id: record.id,
            event_id: record.eventId,
            event_type: record.eventType,
            resource_type: record.resourceType,
            resource_id: record.resourceId,
            summary: record.summary,
            status: record.status,
            payload: record.payload,
            error_message: record.errorMessage,
            received_at: record.receivedAt,
            processed_at: record.processedAt,
          },
          { onConflict: "event_id" }
        );
      } catch (err) {
        console.warn("Failed to persist webhook event in Supabase:", err);
      }
    }
  }

  async getAllOrders(): Promise<Order[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("demo_orders")
          .select("*")
          .order("created_at", { ascending: false });

        if (data && !error && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            orderNumber: d.order_number,
            customerName: d.customer_name,
            customerEmail: d.customer_email,
            shippingAddress: d.shipping_address,
            items: d.items || [],
            totalAmount: Number(d.total_amount),
            currency: d.currency,
            status: d.status as OrderStatus,
            createdAt: d.created_at,
            trackingNumber: d.tracking_number,
            paypalOrderId: d.paypal_order_id,
            paypalCaptureId: d.paypal_capture_id,
            updatedAt: d.updated_at,
          }));
        }
      } catch (err) {
        console.warn("Supabase getAllOrders failed, falling back to local memory store:", err);
      }
    }

    // Collect distinct orders (since we index both id and orderNumber)
    const distinct = new Map<string, Order>();
    this.orders.forEach((o) => distinct.set(o.id, o));
    return Array.from(distinct.values());
  }

  async getAllPayments(): Promise<Payment[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("demo_payments")
          .select("*")
          .order("initiated_at", { ascending: false });

        if (data && !error && data.length > 0) {
          return data.map((p) => ({
            id: p.id,
            transactionId: p.transaction_id || p.id,
            amount: Number(p.amount),
            currency: p.currency,
            status: p.status as PaymentStatus,
            gateway: p.gateway,
            gatewayReference: p.gateway_reference,
            initiatedAt: p.initiated_at,
            settledAt: p.settled_at,
            errorMessage: p.error_message,
            paypalOrderId: p.paypal_order_id,
            paypalCaptureId: p.paypal_capture_id,
          }));
        }
      } catch (err) {
        console.warn("Supabase getAllPayments failed, falling back to local memory store:", err);
      }
    }

    return Array.from(this.payments.values());
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }
}

// Global singleton instance on server
const globalForOrdersStore = globalThis as unknown as {
  ordersStoreInstance?: ServerOrdersStore;
};

export const serverOrdersStore =
  globalForOrdersStore.ordersStoreInstance || new ServerOrdersStore();

if (process.env.NODE_ENV !== "production") {
  globalForOrdersStore.ordersStoreInstance = serverOrdersStore;
}
