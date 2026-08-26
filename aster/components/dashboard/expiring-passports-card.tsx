import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpiringPassport } from "@/types/dashboard";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function ExpiringPassportsCard({ passports }: { passports: ExpiringPassport[] }) {
  if (passports.length === 0) return null;

  return (
    <Card className="border-amber-500/50">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <CardTitle className="text-base">
          {passports.length} passport{passports.length === 1 ? "" : "s"} expiring soon
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {passports.map((p) => (
          <Link
            key={`${p.caseId}-${p.travelerId}`}
            href={`/dashboard/cases/${p.caseId}`}
            className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.travelerType === "PATIENT" ? "Patient" : "Attendant"} · Case {p.caseNumber}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {formatDate(p.passportExpiry)} ({daysUntil(p.passportExpiry)}d)
            </p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
