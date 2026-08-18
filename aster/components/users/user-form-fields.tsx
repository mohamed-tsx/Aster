"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CreateUserFormValues,
  UpdateUserFormValues,
} from "@/lib/validations/user";
import { UsernameField } from "@/components/users/username-field";
import { PasswordField } from "@/components/users/password-field";

type FormValues = CreateUserFormValues | UpdateUserFormValues;

export function AccountFields({
  form,
  isCreate,
  lockedRole,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  isCreate: boolean;
  /** When set, the role field is shown read-only instead of editable */
  lockedRole?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {lockedRole ? (
          <div className="sm:col-span-2">
            <p className="text-sm font-medium">Role</p>
            <p className="text-sm text-muted-foreground">{lockedRole}</p>
          </div>
        ) : (
          <TextField
            form={form}
            name="role"
            label="Role"
            className="sm:col-span-2"
          />
        )}

        <TextField form={form} name="firstName" label="First name" />
        <TextField form={form} name="lastName" label="Last name" />
        <UsernameField form={form} />
        <TextField form={form} name="email" label="Email (optional)" type="email" />

        {isCreate && (
          <PasswordField
            form={form as UseFormReturn<CreateUserFormValues>}
            name="password"
            className="sm:col-span-2"
          />
        )}

        {!isCreate && (
          <PasswordField
            form={form as UseFormReturn<UpdateUserFormValues>}
            name="password"
            label="New password (optional)"
            description="Leave blank to keep the current password."
            className="sm:col-span-2"
          />
        )}
      </CardContent>
    </Card>
  );
}

function TextField({
  form,
  name,
  label,
  type = "text",
  className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  name: string;
  label: string;
  type?: string;
  className?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name as "firstName"}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              {...field}
              value={(field.value as string) ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
