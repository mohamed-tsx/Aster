export type UserRoleRef = {
  id: string;
  name: string;
};

export type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  avatar: string;
  role: UserRoleRef;
  createdAt: string;
  updatedAt: string;
};

export type UsersListResult = {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

export type CreateUserPayload = {
  username: string;
  email?: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type UpdateUserPayload = {
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};
