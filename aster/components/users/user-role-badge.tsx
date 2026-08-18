import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleStyles: Record<string, string> = {
  ADMIN:
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

export function formatRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function UserRoleBadge({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium capitalize",
        roleStyles[role] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {formatRole(role)}
    </Badge>
  );
}
