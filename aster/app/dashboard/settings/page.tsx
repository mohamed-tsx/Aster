"use client";

import { PageHeader } from "@/components/users/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { updateProfile, changePassword, getErrorMessage } from "@/services/auth";
import type { ProfileFormValues, ChangePasswordFormValues } from "@/lib/validations/settings";

export default function SettingsPage() {
  const toast = useToast();
  const { user, updateUser } = useAuthStore();

  if (!user) return null;

  const handleProfileSubmit = async (values: ProfileFormValues, avatarFile: File | null) => {
    try {
      const updated = await updateProfile({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        avatar: avatarFile ?? undefined,
      });
      toast.success("Profile updated");
      // `PUT /auth/profile` returns `role` via a bare Prisma `select: { role: true }`,
      // which carries the Role's scalar fields but not its `permissions` relation.
      // Merging that in would silently wipe the store's permissions until next
      // login, so only the fields this form can actually change are applied.
      const { firstName, lastName, email, avatar } = updated as {
        firstName: string;
        lastName: string;
        email: string | null;
        avatar: string | null;
      };
      updateUser({ firstName, lastName, email: email ?? undefined, avatar });
    } catch (error) {
      toast.error("Could not update profile", getErrorMessage(error));
      throw error;
    }
  };

  const handlePasswordSubmit = async (values: ChangePasswordFormValues) => {
    try {
      await changePassword(values);
      toast.success("Password changed");
    } catch (error) {
      toast.error("Could not change password", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile and password." />

      <ProfileForm
        defaultValues={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email ?? "",
        }}
        avatar={user.avatar}
        onSubmit={handleProfileSubmit}
      />

      <ChangePasswordForm onSubmit={handlePasswordSubmit} />
    </div>
  );
}
