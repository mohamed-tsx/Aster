export type Agency = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  _count: { cases: number };
  createdAt: string;
  updatedAt: string;
};
