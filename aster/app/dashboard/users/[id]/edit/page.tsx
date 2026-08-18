"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/users/page-header";
import { EditUserForm } from "@/components/users/edit-user-form";
import { useUserDetail } from "@/hooks/use-user-detail";
import { updateUser } from "@/services/users";
import { getErrorMessage } from "@/utils/api";
import { buildUpdatePayload } from "@/lib/validations/user";
import { getUserDisplayName } from "@/config/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default function EditUserPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useUserDetail(id);

  const handleUpdate = async (
    payload: ReturnType<typeof buildUpdatePayload>,
  ) => {
    try {
      await updateUser(id, payload);
      toast.success("User details were updated.");
      router.push(`/dashboard/users/${id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update user"));
      throw error;
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title={`Edit ${getUserDisplayName(user)}`}
        description="Update account and profile details."
        backHref={`/dashboard/users/${id}`}
      />
      <EditUserForm user={user} onSubmit={handleUpdate} />
    </div>
  );
}
