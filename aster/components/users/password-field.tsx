"use client";

import { useState } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DEFAULT_USER_PASSWORD } from "@/lib/constants/password";
import { cn } from "@/lib/utils";

type PasswordFieldProps<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  label?: string;
  description?: string;
  className?: string;
  /** Also set confirm field when using reset-password form */
  confirmFieldName?: FieldPath<T>;
  showGenerator?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
};

export function PasswordField<T extends FieldValues>({
  form,
  name,
  label = "Password",
  description = "At least 8 characters with uppercase, lowercase, and a number.",
  className,
  confirmFieldName,
  showGenerator = true,
  visible: visibleProp,
  onVisibleChange,
}: PasswordFieldProps<T>) {
  const [internalVisible, setInternalVisible] = useState(false);
  const visible = visibleProp ?? internalVisible;
  const setVisible = onVisibleChange ?? setInternalVisible;

  const applyDefaultPassword = () => {
    form.setValue(name, DEFAULT_USER_PASSWORD as never, {
      shouldValidate: true,
      shouldDirty: true,
    });
    if (confirmFieldName) {
      form.setValue(confirmFieldName, DEFAULT_USER_PASSWORD as never, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    setVisible(true);
  };

  const toggleVisible = () => setVisible(!visible);

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                className={cn(showGenerator ? "pr-20" : "pr-10")}
                {...field}
              />
              <div className="absolute right-0 top-0 flex h-full items-center">
                {showGenerator && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-full w-9 shrink-0"
                    onClick={applyDefaultPassword}
                    title={`Use default password (${DEFAULT_USER_PASSWORD})`}
                    aria-label={`Generate default password ${DEFAULT_USER_PASSWORD}`}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-full w-9 shrink-0"
                  onClick={toggleVisible}
                  aria-label={visible ? "Hide password" : "Show password"}
                >
                  {visible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
