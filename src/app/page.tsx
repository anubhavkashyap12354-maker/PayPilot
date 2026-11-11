import React from "react";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import KPIGrid from "@/components/dashboard/KPIGrid";
import RevenueChart from "@/components/dashboard/RevenueChart";
import RecentTransactionsTable from "@/components/dashboard/RecentTransactionsTable";
import BusinessActivityPanel from "@/components/dashboard/BusinessActivityPanel";
import IntelligencePreviewCard from "@/components/dashboard/IntelligencePreviewCard";

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

      {/* 4. Recent Transactions Table */}
      <RecentTransactionsTable limit={5} showViewAll={true} />
    </div>
  );
}
