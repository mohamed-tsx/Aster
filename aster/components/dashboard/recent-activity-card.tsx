import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem, ActivityType } from "@/types/dashboard";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

const DESCRIBE: Record<ActivityType, (item: ActivityItem) => string> = {
  CASE_CREATED: () => "New case created",
  PAYMENT_RECEIVED: (item) => `Payment received: ${item.amount} ${item.currency}`,
  EXPENSE_PAID: (item) => `Expense recorded: ${item.category} — ${item.amount} ${item.currency}`,
  REFUND_ISSUED: (item) => `Refund issued: ${item.amount}`,
  DOCUMENT_UPLOADED: (item) => `Document uploaded: ${item.fileName}`,
};

export function RecentActivityCard({ activity }: { activity: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activity.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        )}
        {activity.map((item, index) => (
          <div
            key={`${item.type}-${item.occurredAt}-${index}`}
            className="flex items-center justify-between rounded-md border p-3 text-sm"
          >
            <div>
              <p>{DESCRIBE[item.type](item)}</p>
              {item.caseId && item.caseNumber && (
                <Link
                  href={`/dashboard/cases/${item.caseId}`}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Case {item.caseNumber}
                </Link>
              )}
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">
              {formatDateTime(item.occurredAt)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
