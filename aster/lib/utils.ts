import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFullName(
  user?: { firstName?: string | null; lastName?: string | null } | null
): string {
  if (!user) return "";
  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}
