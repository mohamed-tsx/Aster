"use client";

import { use } from "react";
import Link from "next/link";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { UserDetailView } from "@/components/users/user-detail-view";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useUserDetail } from "@/hooks/use-user-detail";
import { deleteUser } from "@/services/users";
import { useAuthStore } from "@/stores/auth-store";
import { getUserDisplayName } from "@/config/navigation";
import { useRouter } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default function UserDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const { user, loading } = useUserDetail(id);

  const isSelf = currentUser?.id === id;

  const {
    deleteDialogOpen,
    itemToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useDeleteConfirmation({
    itemType: "User",
    onDelete: async (userId) => {
      await deleteUser(userId);
      router.push("/dashboard/users");
    },
  });

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = getUserDisplayName(user);

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title={displayName}
        description={user.email ?? undefined}
        backHref="/dashboard/users"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/users/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button
              variant="destructive"
              disabled={isSelf}
              onClick={() =>
                handleDeleteClick({ id: user.id, name: displayName })
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </>
        }
      />

      <UserDetailView user={user} />

      {isSelf && (
        <p className="text-xs text-muted-foreground">
          You cannot delete your own account from this screen.
        </p>
      )}

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete user"
        description="This permanently removes the user."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
