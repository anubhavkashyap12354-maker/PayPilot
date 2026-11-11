import React, { Suspense } from "react";
import OrdersView from "@/components/orders/OrdersView";

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-xs text-slate-400">
          Loading orders and sandbox telemetry...
        </div>
      }
    >
      <OrdersView />
    </Suspense>
  );
}
