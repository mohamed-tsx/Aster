import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinanceStats } from "@/types/dashboard";

export function FinanceSnapshotCard({ stats }: { stats: FinanceStats }) {
  const balances = Object.entries(stats.totalBalances).filter(([, amount]) => amount !== 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Finance snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">No account balances yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {balances.map(([currency, amount]) => (
              <div key={currency} className="rounded-md border p-3">
                <p className="text-2xl font-semibold">
                  {amount.toFixed(2)} <span className="text-sm font-normal">{currency}</span>
                </p>
                <p className="text-xs text-muted-foreground">Total across accounts</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {stats.accountCount} active account{stats.accountCount === 1 ? "" : "s"}
        </p>
      </CardContent>
    </Card>
  );
}
