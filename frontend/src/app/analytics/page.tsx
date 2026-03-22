"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import AnalyticsDashboard from "@/components/Pages/Analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsDashboard />
    </ProtectedRoute>
  );
}
