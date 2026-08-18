"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { UsersTable } from "@/components/users/users-table";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { usePagination } from "@/hooks/use-pagination";
import { useAuthStore } from "@/stores/auth-store";
import { listUsers, deleteUser } from "@/services/users";
import { getUserDisplayName } from "@/config/navigation";
import type { AdminUser } from "@/types/user";

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, limit, setPage, setLimit } = usePagination();
  const [total, setTotal] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listUsers({ page, limit });
      setUsers(result.users);
      setTotal(result.total);
    } catch (error) {
      console.error(error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const {
    deleteDialogOpen,
    itemToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useDeleteConfirmation({
    itemType: "User",
    onDelete: async (id) => {
      await deleteUser(id);
    },
    onSuccess: fetchUsers,
  });

  const onDeleteUser = (user: AdminUser) => {
    handleDeleteClick({
      id: user.id,
      name: getUserDisplayName(user),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage platform accounts and roles."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={fetchUsers} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button asChild>
              <Link href="/dashboard/users/new">
                <Plus className="mr-2 h-4 w-4" />
                Add user
              </Link>
            </Button>
          </>
        }
      />

      <UsersTable
        users={users}
        loading={loading}
        currentUserId={currentUser?.id}
        onDelete={onDeleteUser}
      />

      <ListPagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="users"
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete user"
        description="This permanently removes the user. This action cannot be undone."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
