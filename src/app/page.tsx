import React from "react";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import KPIGrid from "@/components/dashboard/KPIGrid";
import RevenueChart from "@/components/dashboard/RevenueChart";
import RecentTransactionsTable from "@/components/dashboard/RecentTransactionsTable";
import BusinessActivityPanel from "@/components/dashboard/BusinessActivityPanel";
import IntelligencePreviewCard from "@/components/dashboard/IntelligencePreviewCard";
import { PaymentStatusChart } from "@/components/dashboard/PaymentStatusChart";
import { PaymentMethodChart } from "@/components/dashboard/PaymentMethodChart";
import { DEMO_TRANSACTIONS } from "@/lib/demo-data";

export default function OverviewDashboardPage() {
  return (
    <div className="space-y-6">
      {/* 1. Welcome Section */}
      <WelcomeBanner />

      {/* 2. KPI Cards */}
      <KPIGrid />

      {/* 3. Middle Section: Revenue Analytics & Intelligence Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="flex flex-col gap-6">
          <IntelligencePreviewCard />
          <BusinessActivityPanel />
        </div>
      </div>

      {/* 4. Payment Insights: Status Distribution & Method Breakdown */}
      <section aria-label="Payment Insights" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Payment Insights
          </h2>
          <span className="text-xs text-slate-400">
            Verified Settlement Records
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PaymentStatusChart transactions={DEMO_TRANSACTIONS} />
          <PaymentMethodChart transactions={DEMO_TRANSACTIONS} />
        </div>
      </section>

      {/* 5. Recent Transactions Table */}
      <RecentTransactionsTable limit={5} showViewAll={true} />
    </div>
  );
}
