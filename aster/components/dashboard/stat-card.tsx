import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  href,
  accent = "primary",
}: {
  label: string;
  value: string;
  caption?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  accent?: "primary" | "accent" | "muted";
}) {
  const iconWrapClass = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
  }[accent];

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", iconWrapClass)}>
            <Icon className="size-4" />
          </div>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {(caption || href) && (
          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>{caption}</span>
            {href && (
              <Link href={href} className="flex items-center gap-1 shrink-0 hover:text-foreground">
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
