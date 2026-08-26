import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function CasePipelineCard({ stats }: { stats: CaseStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Case pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <StatTile
              key={status}
              label={status.replace(/_/g, " ")}
              value={stats.statusCounts[status] ?? 0}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
          <div>
            <p className="font-medium">{stats.pendingInquiries}</p>
            <p className="text-xs text-muted-foreground">Pending hospital inquiries</p>
          </div>
          <div>
            <p className="font-medium">{stats.visasAwaitingFee}</p>
            <p className="text-xs text-muted-foreground">Visas awaiting fee</p>
          </div>
          <div>
            <p className="font-medium">{stats.visasAwaitingEmbassyVisit}</p>
            <p className="text-xs text-muted-foreground">Awaiting embassy visit</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
