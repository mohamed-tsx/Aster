export type Permission = {
  id: string;
  name: string;
  _count: { roles: number };
  createdAt: string;
  updatedAt: string;
};

export type Role = {
  id: string;
  name: string;
  permissions: { id: string; name: string }[];
  _count: { users: number };
  createdAt: string;
  updatedAt: string;
};
