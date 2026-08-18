"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { roleSchema, type RoleFormValues } from "@/lib/validations/role";
import type { Permission, Role } from "@/types/role";

type RoleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  permissions: Permission[];
  onSubmit: (values: RoleFormValues) => Promise<void>;
};

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  permissions,
  onSubmit,
}: RoleFormDialogProps) {
  const isAdminRole = role?.name === "ADMIN";
  const form = useForm<RoleFormValues>({
    defaultValues: { name: "", permissionIds: [] },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: role?.name ?? "",
        permissionIds: role?.permissions.map((p) => p.id) ?? [],
      });
    }
  }, [open, role, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "Add role"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = roleSchema.safeParse(values);
              if (!parsed.success) return;
              await onSubmit(parsed.data);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isAdminRole} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Permissions</p>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
                {permissions.map((permission) => {
                  const checked = form.watch("permissionIds").includes(permission.id);
                  const lockedManageRoles = isAdminRole && permission.name === "MANAGE_ROLES";
                  return (
                    <label key={permission.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        disabled={lockedManageRoles}
                        onCheckedChange={(value) => {
                          const current = form.getValues("permissionIds");
                          form.setValue(
                            "permissionIds",
                            value
                              ? [...current, permission.id]
                              : current.filter((id) => id !== permission.id),
                          );
                        }}
                      />
                      {permission.name}
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
