"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  createUserSchema,
  buildCreatePayload,
  type CreateUserFormValues,
} from "@/lib/validations/user";
import { AccountFields } from "@/components/users/user-form-fields";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { listRoles, getErrorMessage } from "@/services/roles";
import type { Role } from "@/types/role";

const defaultValues: CreateUserFormValues = {
  roleId: "",
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
};

type CreateUserFormProps = {
  onSubmit: (payload: ReturnType<typeof buildCreatePayload>) => Promise<void>;
  submitLabel?: string;
};

export function CreateUserForm({
  onSubmit,
  submitLabel = "Create user",
}: CreateUserFormProps) {
  const toast = useToast();
  const { hasRole, permissions } = useRBAC();
  const form = useForm<CreateUserFormValues>({ defaultValues });
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  useEffect(() => {
    listRoles()
      .then((all) => setAllRoles(all))
      .catch((error) => toast.error("Failed to load roles", getErrorMessage(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roles = useMemo(
    () =>
      allRoles.filter(
        (r) => hasRole("ADMIN") || r.permissions.every((p) => permissions.includes(p.name)),
      ),
    [allRoles, hasRole, permissions],
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          const parsed = createUserSchema.safeParse(values);
          if (!parsed.success) {
            toast.error(
              "Validation error",
              parsed.error.issues[0]?.message ?? "Fix form errors",
            );
            return;
          }
          await onSubmit(buildCreatePayload(parsed.data));
        })}
        className="space-y-6"
      >
        <AccountFields form={form} isCreate roles={roles} />
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
