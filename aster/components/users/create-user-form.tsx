"use client";

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

const defaultValues: CreateUserFormValues = {
  role: "",
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
  const form = useForm<CreateUserFormValues>({ defaultValues });

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
        <AccountFields form={form} isCreate />
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
