const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const MS_PER_DAY = 86_400_000;

/**
 * Pure interest & outstanding-balance projection for a loan.
 *
 * @param {object} loan - { principal, interestRatePct, interestMethod, disbursedOn, termMonths, dueOn }
 *   Decimal fields may arrive as Decimal | string | number; every one is coerced with Number().
 * @param {Array<{ amount: * }>} repayments
 * @param {Date} asOf
 * @returns {{ accruedInterest: number, totalRepaid: number, outstanding: number, isOverdue: boolean }}
 *   all numbers rounded to 2dp.
 */
export const loanProjection = (loan, repayments = [], asOf = new Date()) => {
  const principal = Number(loan.principal);
  const ratePct = Number(loan.interestRatePct);
  const termMonths = Number(loan.termMonths);
  const disbursedOn = new Date(loan.disbursedOn);
  const dueOn = new Date(loan.dueOn);

  let accruedInterest;
  if (loan.interestMethod === "COMPOUND_MONTHLY") {
    // Ruling 3.1: whole CALENDAR months from disbursedOn to asOf, clamped to [0, termMonths].
    let elapsedMonths =
      (asOf.getFullYear() - disbursedOn.getFullYear()) * 12 +
      (asOf.getMonth() - disbursedOn.getMonth());
    if (asOf.getDate() < disbursedOn.getDate()) elapsedMonths -= 1;
    elapsedMonths = Math.min(Math.max(0, elapsedMonths), termMonths);

    const monthlyRate = ratePct / 100 / 12;
    accruedInterest = principal * (Math.pow(1 + monthlyRate, elapsedMonths) - 1);
  } else {
    // Ruling 3.2: SIMPLE stays day-based. elapsedYears = days / 365, clamped [0, termMonths/12].
    const elapsedDays = (asOf.getTime() - disbursedOn.getTime()) / MS_PER_DAY;
    const elapsedYears = Math.min(
      Math.max(0, elapsedDays / 365),
      termMonths / 12,
    );
    accruedInterest = principal * (ratePct / 100) * elapsedYears;
  }

  const totalRepaid = repayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const outstanding = Math.max(
    0,
    round2(principal + accruedInterest - totalRepaid),
  );

  return {
    accruedInterest: round2(accruedInterest),
    totalRepaid: round2(totalRepaid),
    outstanding,
    isOverdue: asOf.getTime() > dueOn.getTime() && outstanding > 0,
  };
};
