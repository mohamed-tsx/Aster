"use client";

import { PageHeader } from "@/components/users/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesTab } from "@/components/roles/roles-tab";
import { usePermissionGuard } from "@/hooks/use-permission-guard";

export default function RolesPage() {
  const allowed = usePermissionGuard("MANAGE_ROLES");
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage roles and the permissions assigned to them."
      />
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="mt-4">
          <RolesTab />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <p className="text-sm text-muted-foreground">Coming in the next task.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
