"use client";

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

type EditUserFormProps = {
  user: AdminUser;
  onSubmit: (payload: ReturnType<typeof buildUpdatePayload>) => Promise<void>;
  submitLabel?: string;
};

function mapUserToForm(user: AdminUser): UpdateUserFormValues {
  return {
    role: user.role.name,
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
  const { hasPermission } = useRBAC();
  const form = useForm<UpdateUserFormValues>({
    defaultValues: mapUserToForm(user),
  });

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
          lockedRole={hasPermission("MANAGE_ROLES") ? undefined : user.role.name}
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
