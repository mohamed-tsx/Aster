"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PermissionFormDialog } from "@/components/roles/permission-form-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import {
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  getErrorMessage,
} from "@/services/permissions";
import type { Permission } from "@/types/role";
import type { PermissionFormValues } from "@/lib/validations/role";

const SYSTEM_PERMISSION = "MANAGE_ROLES";

export function PermissionsTab() {
  const toast = useToast();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setPermissions(await listPermissions());
    } catch (error) {
      toast.error("Failed to load permissions", getErrorMessage(error));
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
    itemType: "Permission",
    onDelete: async (id) => {
      await deletePermission(id);
    },
    onSuccess: fetchAll,
  });

  const openCreate = () => {
    setEditingPermission(null);
    setDialogOpen(true);
  };

  const openEdit = (permission: Permission) => {
    setEditingPermission(permission);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: PermissionFormValues) => {
    try {
      if (editingPermission) {
        await updatePermission(editingPermission.id, values);
        toast.success("Permission updated");
      } else {
        await createPermission(values);
        toast.success("Permission created");
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
          Add permission
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Roles using it</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => {
              const isSystem = permission.name === SYSTEM_PERMISSION;
              return (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">{permission.name}</TableCell>
                  <TableCell>{permission._count.roles}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isSystem}
                      title={isSystem ? "System permission — cannot be renamed" : undefined}
                      onClick={() => openEdit(permission)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isSystem}
                      title={isSystem ? "System permission — cannot be deleted" : undefined}
                      onClick={() => handleDeleteClick({ id: permission.id, name: permission.name })}
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

      <PermissionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        permission={editingPermission}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete permission"
        description="This removes the permission from every role that has it."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
