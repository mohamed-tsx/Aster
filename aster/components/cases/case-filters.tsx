"use client";

import { useEffect, useState } from "react";
import { Search, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuthStore } from "@/stores/auth-store";
import { useRBAC } from "@/hooks/useRBAC";
import { listUsers } from "@/services/users";
import type { CaseStatus, ReachOutType } from "@/types/case";
import type { AdminUser } from "@/types/user";

export type CaseFiltersValue = {
  status: CaseStatus | "";
  reachOutType: ReachOutType | "";
  assignedToId: string;
  q: string;
};

const STATUSES: CaseStatus[] = [
  "NEW",
  "HOSPITAL_MATCHING",
  "HOSPITAL_ACCEPTED",
  "HOSPITAL_DECLINED",
  "VISA_PROCESSING",
  "COMPLETED",
  "CANCELLED",
];

const ALL = "__all__";

type CaseFiltersProps = {
  value: CaseFiltersValue;
  onChange: (value: CaseFiltersValue) => void;
};

export function CaseFilters({ value, onChange }: CaseFiltersProps) {
  const { user } = useAuthStore();
  const { hasPermission } = useRBAC();
  const [searchInput, setSearchInput] = useState(value.q);
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const canListUsers = hasPermission("VIEW_USERS");

  useEffect(() => {
    if (!canListUsers) return;
    listUsers({ limit: 100 })
      .then((result) => setUsers(result.users))
      .catch(() => setUsers([]));
  }, [canListUsers]);

  useEffect(() => {
    if (debouncedSearch !== value.q) {
      onChange({ ...value, q: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const isMine = !!user && value.assignedToId === user.id;
  const hasFilters = value.status || value.reachOutType || value.assignedToId || value.q;

  const clearAll = () => {
    setSearchInput("");
    onChange({ status: "", reachOutType: "", assignedToId: "", q: "" });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search case #, patient, passport..."
          className="pl-8"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <Select
        value={value.status || ALL}
        onValueChange={(v) => onChange({ ...value, status: v === ALL ? "" : (v as CaseStatus) })}
      >
        <SelectTrigger className="w-full sm:w-[170px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {status.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.reachOutType || ALL}
        onValueChange={(v) =>
          onChange({ ...value, reachOutType: v === ALL ? "" : (v as ReachOutType) })
        }
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All sources</SelectItem>
          <SelectItem value="DIRECT">Direct</SelectItem>
          <SelectItem value="AGENCY">Agency</SelectItem>
        </SelectContent>
      </Select>

      {canListUsers && (
        <Select
          value={value.assignedToId || ALL}
          onValueChange={(v) => onChange({ ...value, assignedToId: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Assigned to" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Everyone</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {user && (
        <Button
          type="button"
          variant={isMine ? "default" : "outline"}
          size="sm"
          onClick={() => onChange({ ...value, assignedToId: isMine ? "" : user.id })}
        >
          <UserCheck className="mr-2 h-4 w-4" />
          My cases
        </Button>
      )}

      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
