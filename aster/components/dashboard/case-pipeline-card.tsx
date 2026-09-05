"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CaseStats } from "@/types/dashboard";
import type { CaseStatus } from "@/types/case";

const STATUS_ORDER: CaseStatus[] = [
  "NEW",
  "HOSPITAL_MATCHING",
  "HOSPITAL_ACCEPTED",
  "HOSPITAL_DECLINED",
  "VISA_PROCESSING",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_LABEL: Record<CaseStatus, string> = {
  NEW: "New",
  HOSPITAL_MATCHING: "Matching",
  HOSPITAL_ACCEPTED: "Accepted",
  HOSPITAL_DECLINED: "Declined",
  VISA_PROCESSING: "Visa",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLOR: Record<CaseStatus, string> = {
  NEW: "var(--primary)",
  HOSPITAL_MATCHING: "var(--primary)",
  HOSPITAL_ACCEPTED: "var(--accent)",
  HOSPITAL_DECLINED: "var(--destructive)",
  VISA_PROCESSING: "var(--primary)",
  COMPLETED: "var(--accent)",
  CANCELLED: "var(--destructive)",
};

const chartConfig = {
  count: { label: "Cases" },
} satisfies ChartConfig;

export function CasePipelineCard({ stats }: { stats: CaseStats }) {
  const data = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: stats.statusCounts[status] ?? 0,
  }));

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="gap-4">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">Case pipeline</CardTitle>
          <p className="text-sm text-muted-foreground">{total} cases across all statuses</p>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <BarChart data={data} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((d) => (
                <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
