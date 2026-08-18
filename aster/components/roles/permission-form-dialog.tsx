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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { permissionSchema, type PermissionFormValues } from "@/lib/validations/role";
import type { Permission } from "@/types/role";

type PermissionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: Permission | null;
  onSubmit: (values: PermissionFormValues) => Promise<void>;
};

export function PermissionFormDialog({
  open,
  onOpenChange,
  permission,
  onSubmit,
}: PermissionFormDialogProps) {
  const form = useForm<PermissionFormValues>({ defaultValues: { name: "" } });

  useEffect(() => {
    if (open) {
      form.reset({ name: permission?.name ?? "" });
    }
  }, [open, permission, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{permission ? "Rename permission" : "Add permission"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = permissionSchema.safeParse(values);
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
                  <FormLabel>Permission name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. VIEW_REPORTS" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
