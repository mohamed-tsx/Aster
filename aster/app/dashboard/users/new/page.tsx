"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/users/page-header";
import { CreateUserForm } from "@/components/users/create-user-form";
import { createUser } from "@/services/users";
import { getErrorMessage } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { buildCreatePayload } from "@/lib/validations/user";

export default function NewUserPage() {
  const router = useRouter();
  const toast = useToast();

  const handleCreate = async (
    payload: ReturnType<typeof buildCreatePayload>,
  ) => {
    try {
      const user = await createUser(payload);
      toast.success(
        "User created",
        `${user.firstName} ${user.lastName} was added.`,
      );
      router.push(`/dashboard/users/${user.id}`);
    } catch (error) {
      toast.error(
        "Create failed",
        getErrorMessage(error, "Could not create user"),
      );
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Add user"
        description="Create a new account."
        backHref="/dashboard/users"
      />
      <CreateUserForm onSubmit={handleCreate} />
    </div>
  );
}
