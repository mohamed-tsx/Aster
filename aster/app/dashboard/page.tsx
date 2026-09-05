"use client";

import { useEffect, useState } from "react";
import { Loader2, FolderKanban, Activity, Building2, Wallet } from "lucide-react";
import { CasePipelineCard } from "@/components/dashboard/case-pipeline-card";
import { VisaPipelineCard } from "@/components/dashboard/visa-pipeline-card";
import { FinanceSnapshotCard } from "@/components/dashboard/finance-snapshot-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { ExpiringPassportsCard } from "@/components/dashboard/expiring-passports-card";
import { StatCard } from "@/components/dashboard/stat-card";
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

  const totalCases = caseStats
    ? Object.values(caseStats.statusCounts).reduce((sum, n) => sum + n, 0)
    : 0;
  const activeCases = caseStats
    ? totalCases - (caseStats.statusCounts.COMPLETED ?? 0) - (caseStats.statusCounts.CANCELLED ?? 0)
    : 0;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {user ? `Welcome back, ${user.firstName}.` : "Welcome."}
        </p>
      </div>

      {canViewCases && <ExpiringPassportsCard passports={expiringPassports} />}

      {(caseStats || financeStats) && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {caseStats && (
            <>
              <StatCard
                label="Total cases"
                value={totalCases.toLocaleString()}
                caption="Across all statuses"
                icon={FolderKanban}
                href="/dashboard/cases"
                accent="primary"
              />
              <StatCard
                label="Active cases"
                value={activeCases.toLocaleString()}
                caption="Not completed or cancelled"
                icon={Activity}
                href="/dashboard/cases"
                accent="accent"
              />
              <StatCard
                label="Pending inquiries"
                value={caseStats.pendingInquiries.toLocaleString()}
                caption="Awaiting hospital response"
                icon={Building2}
                href="/dashboard/hospitals"
                accent="muted"
              />
            </>
          )}
          {financeStats && (
            <StatCard
              label="Active accounts"
              value={financeStats.accountCount.toLocaleString()}
              caption="Holding a balance"
              icon={Wallet}
              href="/dashboard/accounts"
              accent="primary"
            />
          )}
        </div>
      )}

      {caseStats && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CasePipelineCard stats={caseStats} />
          </div>
          <VisaPipelineCard stats={caseStats} />
        </div>
      )}

      {financeStats && canViewCases && (
        <div className="grid gap-6 lg:grid-cols-2">
          <FinanceSnapshotCard stats={financeStats} />
          <RecentActivityCard activity={activity} />
        </div>
      )}
      {financeStats && !canViewCases && <FinanceSnapshotCard stats={financeStats} />}
      {!financeStats && canViewCases && <RecentActivityCard activity={activity} />}

      {!canViewCases && !canViewFinance && (
        <p className="text-sm text-muted-foreground">
          Nothing to show yet — ask an administrator for access to cases or finance.
        </p>
      )}
    </div>
  );
}
