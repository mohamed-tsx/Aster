"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CasePipelineCard } from "@/components/dashboard/case-pipeline-card";
import { FinanceSnapshotCard } from "@/components/dashboard/finance-snapshot-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { ExpiringPassportsCard } from "@/components/dashboard/expiring-passports-card";
import { useRBAC } from "@/hooks/useRBAC";
import {
  getCaseStats,
  getFinanceStats,
  getRecentActivity,
  getExpiringPassports,
} from "@/services/dashboard";
import type { ActivityItem, CaseStats, ExpiringPassport, FinanceStats } from "@/types/dashboard";

export default function DashboardHome() {
  const { hasPermission, user } = useRBAC();
  const canViewCases = hasPermission("VIEW_CASES");
  const canViewFinance = hasPermission("VIEW_FINANCE");

  const [caseStats, setCaseStats] = useState<CaseStats | null>(null);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [expiringPassports, setExpiringPassports] = useState<ExpiringPassport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      canViewCases ? getCaseStats() : Promise.resolve(null),
      canViewFinance ? getFinanceStats() : Promise.resolve(null),
      canViewCases ? getRecentActivity(10) : Promise.resolve([]),
      canViewCases ? getExpiringPassports(90) : Promise.resolve([]),
    ])
      .then(([cases, finance, recent, expiring]) => {
        if (cancelled) return;
        setCaseStats(cases);
        setFinanceStats(finance);
        setActivity(recent);
        setExpiringPassports(expiring);
      })
      .catch(() => {
        if (!cancelled) {
          setCaseStats(null);
          setFinanceStats(null);
          setActivity([]);
          setExpiringPassports([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, canViewCases, canViewFinance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {user ? `Welcome back, ${user.firstName}.` : "Welcome."}
        </p>
      </div>

      {canViewCases && <ExpiringPassportsCard passports={expiringPassports} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {caseStats && <CasePipelineCard stats={caseStats} />}
        {financeStats && <FinanceSnapshotCard stats={financeStats} />}
      </div>

      {canViewCases && <RecentActivityCard activity={activity} />}

      {!canViewCases && !canViewFinance && (
        <p className="text-sm text-muted-foreground">
          Nothing to show yet — ask an administrator for access to cases or finance.
        </p>
      )}
    </div>
  );
}
