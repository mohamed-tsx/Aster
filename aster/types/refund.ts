export type Refund = {
  id: string;
  paymentId: string;
  amount: string;
  reason: string;
  refundedById: string;
  refundedAt: string;
  createdAt: string;
};
