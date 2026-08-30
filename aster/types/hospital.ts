export type Hospital = {
  id: string;
  name: string;
  city: string;
  country: string;
  specialties: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  _count: { inquiries: number };
  createdAt: string;
  updatedAt: string;
};
