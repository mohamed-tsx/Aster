"use client";

import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { FinanceStats } from "@/types/dashboard";

const CURRENCIES = ["USD", "INR"] as const;

const chartConfig = {
  balance: { label: "Balance", color: "var(--primary)" },
  loans: { label: "Outstanding loans", color: "var(--accent)" },
  payables: { label: "Outstanding payables", color: "var(--destructive)" },
} satisfies ChartConfig;

export function FinanceSnapshotCard({ stats }: { stats: FinanceStats }) {
  const balances = Object.entries(stats.totalBalances).filter(([, amount]) => amount !== 0);

  const data = CURRENCIES.map((currency) => ({
    currency,
    balance: stats.totalBalances[currency] ?? 0,
    loans: stats.outstandingLoans?.[currency] ?? 0,
    payables: stats.outstandingPayables?.[currency] ?? 0,
  }));

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Finance snapshot</CardTitle>
        <p className="text-sm text-muted-foreground">
          {stats.accountCount} active account{stats.accountCount === 1 ? "" : "s"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">No account balances yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {balances.map(([currency, amount]) => (
              <div key={currency} className="rounded-md border p-3">
                <p className="text-2xl font-semibold tabular-nums">
                  {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{currency}</span>
                </p>
                <p className="text-xs text-muted-foreground">Total across accounts</p>
              </div>
            ))}
          </div>
        )}

        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <BarChart data={data} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="currency" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend content={<ChartLegendContent />} />
            <Bar dataKey="balance" fill="var(--color-balance)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="loans" fill="var(--color-loans)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="payables" fill="var(--color-payables)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
