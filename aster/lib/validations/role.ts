import { z } from "zod";

export const roleSchema = z.object({
  name: z.string().min(1, "Role name is required").max(50),
  permissionIds: z.array(z.string()).default([]),
});

export type RoleFormValues = z.infer<typeof roleSchema>;

export const permissionSchema = z.object({
  name: z.string().min(1, "Permission name is required").max(50),
});

export type PermissionFormValues = z.infer<typeof permissionSchema>;
