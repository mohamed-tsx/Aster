export function getUserDisplayName(user: {
  firstName?: string;
  lastName?: string;
  username?: string;
  fullName?: string;
}) {
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ");
  }
  return user.fullName || user.username || "User";
}

export function getUserInitials(user: {
  firstName?: string;
  lastName?: string;
  username?: string;
  fullName?: string;
}) {
  const name = getUserDisplayName(user);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] || "U").toUpperCase();
}
