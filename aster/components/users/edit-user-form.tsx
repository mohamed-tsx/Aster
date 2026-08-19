"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  updateUserSchema,
  buildUpdatePayload,
  type UpdateUserFormValues,
} from "@/lib/validations/user";
import type { AdminUser } from "@/types/user";
import { AccountFields } from "@/components/users/user-form-fields";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { listRoles, getErrorMessage } from "@/services/roles";
import type { Role } from "@/types/role";

type EditUserFormProps = {
  user: AdminUser;
  onSubmit: (payload: ReturnType<typeof buildUpdatePayload>) => Promise<void>;
  submitLabel?: string;
};

function mapUserToForm(user: AdminUser): UpdateUserFormValues {
  return {
    roleId: user.role.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email ?? "",
    password: "",
  };
}

export function EditUserForm({
  user,
  onSubmit,
  submitLabel = "Save changes",
}: EditUserFormProps) {
  const toast = useToast();
  const { hasRole, permissions } = useRBAC();
  const form = useForm<UpdateUserFormValues>({
    defaultValues: mapUserToForm(user),
  });
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  useEffect(() => {
    listRoles()
      .then((all) => setAllRoles(all))
      .catch((error) => toast.error("Failed to load roles", getErrorMessage(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roles = useMemo(() => {
    const grantable = allRoles.filter(
      (r) => hasRole("ADMIN") || r.permissions.every((p) => permissions.includes(p.name)),
    );
    const hasCurrent = grantable.some((r) => r.id === user.role.id);
    return hasCurrent
      ? grantable
      : [
          ...grantable,
          { ...user.role, permissions: [], _count: { users: 0 } } as unknown as Role,
        ];
  }, [allRoles, hasRole, permissions, user.role]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          const parsed = updateUserSchema.safeParse(values);
          if (!parsed.success) {
            toast.error(
              "Validation error",
              parsed.error.issues[0]?.message ?? "Fix form errors",
            );
            return;
          }
          await onSubmit(buildUpdatePayload(parsed.data));
        })}
        className="space-y-6"
      >
        <AccountFields
          form={form}
          isCreate={false}
          roles={roles}
          lockedRole={user.role.name}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
