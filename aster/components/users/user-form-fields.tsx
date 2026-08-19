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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CreateUserFormValues,
  UpdateUserFormValues,
} from "@/lib/validations/user";
import type { Role } from "@/types/role";
import { UsernameField } from "@/components/users/username-field";
import { PasswordField } from "@/components/users/password-field";

export function AccountFields({
  form,
  isCreate,
  roles,
  lockedRole,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  isCreate: boolean;
  /** Roles the current user is allowed to grant */
  roles: Role[];
  /** Shown when `roles` is empty and there's a current role to display read-only */
  lockedRole?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {roles.length > 0 ? (
          <FormField
            control={form.control}
            name="roleId"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="sm:col-span-2">
            <p className="text-sm font-medium">Role</p>
            <p className="text-sm text-muted-foreground">
              {lockedRole ?? "No roles available to assign"}
            </p>
          </div>
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
