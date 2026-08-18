import { z } from "zod";
import { USERNAME_PATTERN } from "@/lib/constants/username";

const usernameSchema = z
  .string()
  .min(1, "Username is required")
  .regex(
    USERNAME_PATTERN,
    "Username must be 3–32 characters (letters, numbers, . _ -)",
  );

const emailSchema = z
  .string()
  .email("Invalid email address")
  .optional()
  .or(z.literal(""));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const createUserSchema = z.object({
  role: z.string().min(1, "Role is required"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  role: z.string().min(1, "Role is required"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  username: usernameSchema,
  email: emailSchema,
  password: z.union([passwordSchema, z.literal("")]).optional(),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

export function buildCreatePayload(values: CreateUserFormValues) {
  return {
    role: values.role,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    username: values.username.trim(),
    email: values.email?.trim() ? values.email.trim().toLowerCase() : undefined,
    password: values.password,
  };
}

export function buildUpdatePayload(values: UpdateUserFormValues) {
  return {
    role: values.role,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    username: values.username.trim(),
    email: values.email?.trim() ? values.email.trim().toLowerCase() : undefined,
    ...(values.password ? { password: values.password } : {}),
  };
}
