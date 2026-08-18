"use client";

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type UsernameFieldProps<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name?: FieldPath<T>;
  label?: string;
  className?: string;
};

export function UsernameField<T extends FieldValues>({
  form,
  name = "username" as FieldPath<T>,
  label = "Username",
  className,
}: UsernameFieldProps<T>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input autoComplete="username" {...field} />
          </FormControl>
          <FormDescription>
            3–32 characters: letters, numbers, . _ -
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
