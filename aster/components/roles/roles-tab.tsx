"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  getErrorMessage,
} from "@/services/roles";
import { listPermissions } from "@/services/permissions";
import type { Role, Permission } from "@/types/role";
import type { RoleFormValues } from "@/lib/validations/role";

export function RolesTab() {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, permissionsData] = await Promise.all([
        listRoles(),
        listPermissions(),
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (error) {
      toast.error("Failed to load roles", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const {
    deleteDialogOpen,
    itemToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useDeleteConfirmation({
    itemType: "Role",
    onDelete: async (id) => {
      await deleteRole(id);
    },
    onSuccess: fetchAll,
  });

  const openCreate = () => {
    setEditingRole(null);
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: RoleFormValues) => {
    try {
      if (editingRole) {
        await updateRole(editingRole.id, values);
        toast.success("Role updated");
      } else {
        await createRole(values);
        toast.success("Role created");
      }
      setDialogOpen(false);
      fetchAll();
    } catch (error) {
      toast.error("Save failed", getErrorMessage(error));
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add role
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Users</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const isAdminRole = role.name === "ADMIN";
              const inUse = role._count.users > 0;
              return (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.map((p) => (
                        <Badge key={p.id} variant="outline">
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{role._count.users}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(role)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isAdminRole || inUse}
                      title={
                        isAdminRole
                          ? "The ADMIN role cannot be deleted"
                          : inUse
                            ? "Reassign users before deleting this role"
                            : undefined
                      }
                      onClick={() => handleDeleteClick({ id: role.id, name: role.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
        permissions={permissions}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete role"
        description="This permanently removes the role."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
