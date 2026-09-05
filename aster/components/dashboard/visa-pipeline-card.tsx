import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseStats } from "@/types/dashboard";

export function VisaPipelineCard({ stats }: { stats: CaseStats }) {
  const items = [
    { label: "Pending hospital inquiries", value: stats.pendingInquiries },
    { label: "Visas awaiting fee", value: stats.visasAwaitingFee },
    { label: "Awaiting embassy visit", value: stats.visasAwaitingEmbassyVisit },
    { label: "Awaiting outcome", value: stats.visasAwaitingOutcome },
  ];

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <Card className="gap-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Visa &amp; hospital pipeline</CardTitle>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ListChecks className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-semibold tabular-nums">{item.value}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
