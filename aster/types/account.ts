export type AccountType = "BANK" | "CASH" | "OTHER";

export type AccountBalances = Record<string, number>;

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  isActive: boolean;
  notes: string | null;
  balances: AccountBalances;
  createdAt: string;
  updatedAt: string;
};
