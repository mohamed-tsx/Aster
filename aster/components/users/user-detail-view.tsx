"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserRoleBadge } from "@/components/users/user-role-badge";
import { getUserDisplayName, getUserInitials } from "@/config/navigation";
import { getUserAvatarUrl } from "@/utils/imageUtils";
import type { AdminUser } from "@/types/user";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className={mono ? "font-mono text-xs break-all" : "text-sm"}>
        {value ?? "—"}
      </div>
    </div>
  );
}

export function UserDetailView({ user }: { user: AdminUser }) {
  const name = getUserDisplayName(user);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg ring-2 ring-primary/20">
              <AvatarImage
                src={getUserAvatarUrl(user.avatar)}
                alt={name}
                className="object-cover"
              />
              <AvatarFallback className="bg-linear-to-br from-primary to-primary/60 text-xl font-bold text-white">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <DetailItem label="User ID" value={user.id} mono />
          <DetailItem
            label="Role"
            value={<UserRoleBadge role={user.role.name} />}
          />
          <DetailItem label="First name" value={user.firstName} />
          <DetailItem label="Last name" value={user.lastName} />
          <DetailItem label="Username" value={user.username} />
          <DetailItem label="Email" value={user.email} />
          <DetailItem label="Created" value={formatDateTime(user.createdAt)} />
          <DetailItem label="Last updated" value={formatDateTime(user.updatedAt)} />
        </CardContent>
      </Card>
    </div>
  );
}
