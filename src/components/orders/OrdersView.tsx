"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  Clock,
  RotateCcw,
  MapPin,
  Mail,
  User,
  Truck,
  ExternalLink,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { DEMO_ORDERS } from "@/lib/demo-data";
import { Order, OrderStatus } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";

export const OrdersView: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<Order[]>(DEMO_ORDERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({
    ord_003: true,
    ord_001: false,
  });

  // Checkout interaction state
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [checkoutNotification, setCheckoutNotification] = useState<{
    type: "success" | "warning" | "error";
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  // Simulated sandbox approval modal (for environments without active live sandbox credentials)
  const [mockSandboxModal, setMockSandboxModal] = useState<{
    orderId: string;
    orderNumber: string;
    amount: number;
    currency: string;
    paypalOrderId: string;
  } | null>(null);

  // Handle return from PayPal Sandbox redirect
  useEffect(() => {
    const returnType = searchParams.get("paypal_return");
    const orderId = searchParams.get("orderId");
    const token = searchParams.get("token"); // PayPal Order ID
    const isMock = searchParams.get("paypal_sandbox_modal");

    if (returnType === "success" && orderId) {
      if (isMock && token) {
        // Mock Sandbox Return: Trigger Capture immediately
        handleCaptureOrder(orderId, token);
      } else if (token) {
        // Real PayPal Sandbox Return: Execute server-side capture
        handleCaptureOrder(orderId, token);
      }
    } else if (returnType === "cancel" && orderId) {
      setCheckoutNotification({
        type: "warning",
        title: "PayPal Sandbox Checkout Cancelled",
        message: "You cancelled the PayPal checkout session. The order remains pending and no payment was captured.",
      });
      // Clean query params
      router.replace("/orders");
    }
  }, [searchParams]);

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleInitiatePayPalCheckout = async (order: Order) => {
    setIsProcessing(order.id);
    setCheckoutNotification(null);

    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate PayPal Sandbox Order");
      }

      if (data.isMockSandbox) {
        // Open the in-app simulated sandbox approval modal
        setMockSandboxModal({
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: order.totalAmount,
          currency: order.currency,
          paypalOrderId: data.paypalOrderId,
        });
      } else if (data.approvalUrl) {
        // Redirect to real PayPal Sandbox URL
        window.location.href = data.approvalUrl;
      }
    } catch (err) {
      console.error("PayPal checkout error:", err);
      setCheckoutNotification({
        type: "error",
        title: "Checkout Initiation Failed",
        message: err instanceof Error ? err.message : "Unable to establish connection with PayPal Sandbox.",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleCaptureOrder = async (orderId: string, paypalOrderId: string) => {
    setIsProcessing(orderId);

    try {
      const res = await fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paypalOrderId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment capture was not completed.");
      }

      // Update local orders list state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId || o.orderNumber === data.orderNumber
            ? {
                ...o,
                status: "fulfilled",
                paypalOrderId: data.paypalOrderId,
                paypalCaptureId: data.paypalCaptureId,
                transactionId: data.transactionId,
                trackingNumber: data.trackingNumber || o.trackingNumber,
              }
            : o
        )
      );

      // Auto expand the updated order
      setExpandedOrders((prev) => ({ ...prev, [orderId]: true }));

      setCheckoutNotification({
        type: "success",
        title: "PayPal Sandbox Payment Captured Successfully",
        message: `Order ${data.orderNumber} is now marked as FULFILLED. Server-verified capture recorded.`,
        details: `Capture ID: ${data.paypalCaptureId} | Ledger TXN: ${data.transactionId} | Amount: $${Number(data.amount).toFixed(2)} USD`,
      });

      setMockSandboxModal(null);
      // Clean query parameters
      router.replace("/orders");
    } catch (err) {
      console.error("Capture failed:", err);
      setCheckoutNotification({
        type: "error",
        title: "Capture Verification Failed",
        message: err instanceof Error ? err.message : "Could not complete server capture with PayPal.",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredOrders = useMemo(() => {
    let list = [...orders];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
          (o.paypalOrderId && o.paypalOrderId.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }

    return list;
  }, [orders, search, statusFilter]);

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "fulfilled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#10B981] border border-emerald-100">
            <PackageCheck className="h-3 w-3" />
            Fulfilled
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0284C7] border border-sky-100">
            <Truck className="h-3 w-3" />
            Processing
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-[#F59E0B] border border-amber-100">
            <Clock className="h-3 w-3" />
            Pending Payment
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-100">
            <RotateCcw className="h-3 w-3" />
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Customer Orders & PayPal Sandbox
            </h1>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100">
              PAYPAL SANDBOX TESTBED
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review orders and test the authentic PayPal Orders v2 Sandbox approval & capture workflow
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-600">
            Pending Orders: <span className="font-bold text-amber-600">{orders.filter(o => o.status === "pending").length}</span>
          </div>
        </div>
      </div>

      {/* Checkout Notification Alert */}
      {checkoutNotification && (
        <div
          className={`rounded-2xl p-4 text-xs shadow-sm flex items-start justify-between gap-3 border ${
            checkoutNotification.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : checkoutNotification.type === "warning"
              ? "bg-amber-50 text-amber-900 border-amber-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {checkoutNotification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : checkoutNotification.type === "warning" ? (
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <strong className="block font-bold">{checkoutNotification.title}</strong>
              <span className="mt-0.5 block">{checkoutNotification.message}</span>
              {checkoutNotification.details && (
                <span className="mt-1 block font-mono text-[11px] text-slate-600 bg-white/70 px-2 py-1 rounded-lg border border-slate-200/50">
                  {checkoutNotification.details}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setCheckoutNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order #, customer, tracking #, PayPal ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {["all", "pending", "fulfilled", "processing", "cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition-all ${
                statusFilter === st
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List with Expandable Details and PayPal Sandbox Checkout CTA */}
      <div className="space-y-3">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const isExpanded = !!expandedOrders[order.id];
            const isOrderProcessing = isProcessing === order.id;

            return (
              <div
                key={order.id}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
                  order.status === "pending"
                    ? "border-amber-200/80 hover:border-amber-300"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Order Summary Row */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        order.status === "pending"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-sky-50 text-sky-600"
                      }`}
                    >
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {order.orderNumber}
                        </span>
                        {renderStatusBadge(order.status)}
                        {order.paypalCaptureId && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            PayPal Captured
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{order.customerName}</span>
                        <span>•</span>
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    <div className="text-right">
                      <div className="text-base font-extrabold text-slate-900 font-mono">
                        ${order.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {order.items.length} item{order.items.length > 1 ? "s" : ""}
                      </div>
                    </div>

                    <div className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Order Item Breakdown & Checkout CTA */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1 text-slate-600">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Customer & Delivery
                        </span>
                        <div className="flex items-center gap-2 text-slate-700">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{order.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span>{order.customerEmail}</span>
                        </div>
                        <div className="flex items-start gap-2 text-slate-500">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{order.shippingAddress}</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-slate-600">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Payment & Fulfillment Telemetry
                        </span>
                        <div>
                          <span className="text-slate-400">Tracking Number: </span>
                          <span className="font-mono font-semibold text-slate-800">
                            {order.trackingNumber || "Pending Courier Allocation"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Ledger Reference: </span>
                          <span className="font-mono text-sky-600 font-semibold">
                            {order.transactionId || "Unlinked"}
                          </span>
                        </div>
                        {order.paypalOrderId && (
                          <div>
                            <span className="text-slate-400">PayPal Order ID: </span>
                            <span className="font-mono text-slate-800 font-medium">
                              {order.paypalOrderId}
                            </span>
                          </div>
                        )}
                        {order.paypalCaptureId && (
                          <div>
                            <span className="text-slate-400">PayPal Capture ID: </span>
                            <span className="font-mono text-emerald-700 font-medium">
                              {order.paypalCaptureId}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
                      <div className="bg-slate-100/70 px-4 py-2 font-semibold text-[11px] uppercase tracking-wider text-slate-500 flex justify-between">
                        <span>Line Item</span>
                        <span>Qty × Unit Price = Total</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-4 py-2.5"
                          >
                            <span className="font-medium text-slate-800">
                              {item.productName}
                            </span>
                            <span className="font-mono text-slate-700">
                              {item.quantity} × ${item.unitPrice.toFixed(2)} ={" "}
                              <strong className="text-slate-900">${item.totalPrice.toFixed(2)}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PayPal Sandbox Checkout Callout for Pending Orders */}
                    {order.status === "pending" && (
                      <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/60 via-white to-sky-50/40 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <CreditCard className="h-4 w-4 text-[#0284C7]" />
                              <span>Authorize with PayPal Sandbox Checkout</span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Test order creation, buyer authorization, and server-side capture verification.
                              <span className="ml-1 font-semibold text-amber-700">SANDBOX ONLY — NO REAL FUNDS</span>
                            </p>
                          </div>

                          <button
                            onClick={() => handleInitiatePayPalCheckout(order)}
                            disabled={isOrderProcessing}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0369A1] transition-all disabled:opacity-50 shrink-0 self-start sm:self-auto"
                          >
                            {isOrderProcessing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Initiating Sandbox...</span>
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4" />
                                <span>Pay with PayPal Sandbox (${order.totalAmount.toFixed(2)})</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
            No orders match the selected filter.
          </div>
        )}
      </div>

      {/* Simulated PayPal Sandbox Approval Modal (Fallback when no live sandbox credentials configured) */}
      {mockSandboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white font-bold text-xs">
                  PP
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">PayPal Sandbox Buyer Approval</h3>
                  <span className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">
                    TEST / SANDBOX ENVIRONMENT
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMockSandboxModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Merchant</span>
                <span className="font-semibold text-slate-900">Apex Velocity Technologies Ltd</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Number</span>
                <span className="font-mono text-slate-900">{mockSandboxModal.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PayPal Order ID</span>
                <span className="font-mono text-sky-700">{mockSandboxModal.paypalOrderId}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200/60">
                <span className="font-bold text-slate-900">Total Authorization</span>
                <span className="font-mono font-extrabold text-slate-900 text-sm">
                  ${mockSandboxModal.amount.toFixed(2)} {mockSandboxModal.currency}
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
              This simulated sandbox dialog mimics the PayPal buyer checkout screen. Approving will trigger the authoritative server-side capture API (<code className="rounded bg-slate-100 px-1 py-0.5">POST /api/paypal/capture-order</code>).
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setMockSandboxModal(null);
                  setCheckoutNotification({
                    type: "warning",
                    title: "Checkout Cancelled",
                    message: "Sandbox approval was cancelled. Order remains pending.",
                  });
                }}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel & Return
              </button>

              <button
                onClick={() =>
                  handleCaptureOrder(
                    mockSandboxModal.orderId,
                    mockSandboxModal.paypalOrderId
                  )
                }
                disabled={Boolean(isProcessing)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0369A1]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying Capture...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Approve in Sandbox</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersView;
