"use client";

import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordField } from "@/components/users/password-field";
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from "@/lib/validations/settings";

const DEFAULT_VALUES: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

type ChangePasswordFormProps = {
  onSubmit: (values: ChangePasswordFormValues) => Promise<void>;
};

export function ChangePasswordForm({ onSubmit }: ChangePasswordFormProps) {
  const form = useForm<ChangePasswordFormValues>({ defaultValues: DEFAULT_VALUES });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = changePasswordFormSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof ChangePasswordFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              await onSubmit(parsed.data);
              form.reset(DEFAULT_VALUES);
            })}
            className="space-y-4"
          >
            <PasswordField
              form={form}
              name="currentPassword"
              label="Current password"
              description={undefined}
              showGenerator={false}
            />
            <PasswordField
              form={form}
              name="newPassword"
              label="New password"
              showGenerator={false}
            />
            <PasswordField
              form={form}
              name="confirmPassword"
              label="Confirm new password"
              description={undefined}
              showGenerator={false}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update password
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
