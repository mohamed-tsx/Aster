import { describe, it, expect } from "vitest";
import { loanProjection } from "../../Src/Services/Loans/loanProjection.js";

const loan = (o = {}) => ({
  principal: 1000,
  interestRatePct: 12,
  interestMethod: "SIMPLE",
  disbursedOn: new Date("2026-01-01"),
  termMonths: 12,
  dueOn: new Date("2027-01-01"),
  ...o,
});

describe("loanProjection", () => {
  it("SIMPLE: no interest at disbursement", () => {
    const p = loanProjection(loan(), [], new Date("2026-01-01"));
    expect(p.accruedInterest).toBe(0);
    expect(p.outstanding).toBe(1000);
  });

  it("SIMPLE: half a year -> ~half the annual interest (day-based)", () => {
    const p = loanProjection(loan(), [], new Date("2026-07-01"));
    // Ruling 3.3: Jan 1 -> Jul 1 is 181 days, not exactly 0.5yr.
    // elapsedYears = 181/365 = 0.4958904..., accrued = 1000 * 0.12 * 0.4958904 = 59.5068... -> 59.51
    // outstanding = 1000 + 59.5068... = 1059.5068... -> 1059.51
    // Original brief asserted toBeCloseTo(60, 1) / toBeCloseTo(1060, 1); loosened to precision 0.
    expect(p.accruedInterest).toBeCloseTo(60, 0);
    expect(p.outstanding).toBeCloseTo(1060, 0);
    expect(p.accruedInterest).toBe(59.51);
    expect(p.outstanding).toBe(1059.51);
  });

  it("SIMPLE: interest stops accruing after the term", () => {
    const p = loanProjection(loan(), [], new Date("2030-01-01"));
    // elapsedYears clamped to termMonths/12 = 1 -> 1000 * 0.12 * 1 = 120
    expect(p.accruedInterest).toBeCloseTo(120, 1);
    expect(p.accruedInterest).toBe(120);
  });

  it("COMPOUND_MONTHLY: 3 months (whole calendar months)", () => {
    const p = loanProjection(
      loan({ interestMethod: "COMPOUND_MONTHLY" }),
      [],
      new Date("2026-04-01"),
    );
    // Ruling 3.1/3.4: Jan 1 -> Apr 1 = exactly 3 calendar months.
    // 1000 * ((1 + 0.01)^3 - 1) = 1000 * (1.030301 - 1) = 30.301 -> 30.3
    expect(p.accruedInterest).toBeCloseTo(30.3, 1);
    expect(p.accruedInterest).toBe(30.3);
  });

  it("repayments reduce outstanding; overdue flag", () => {
    const p = loanProjection(
      loan(),
      [{ amount: 400 }, { amount: 300 }],
      new Date("2027-06-01"),
    );
    expect(p.totalRepaid).toBe(700);
    // elapsedYears clamped to 1 -> accrued 120; outstanding = 1000 + 120 - 700 = 420
    expect(p.outstanding).toBeCloseTo(1000 + 120 - 700, 1);
    expect(p.isOverdue).toBe(true);
  });

  it("not overdue once outstanding hits zero", () => {
    const p = loanProjection(loan(), [{ amount: 2000 }], new Date("2030-01-01"));
    expect(p.outstanding).toBe(0);
    expect(p.isOverdue).toBe(false);
  });

  it("coerces Decimal/string fields via Number()", () => {
    const p = loanProjection(
      loan({ principal: "1000", interestRatePct: "12", termMonths: "12" }),
      [{ amount: "100" }],
      new Date("2030-01-01"),
    );
    expect(p.accruedInterest).toBe(120);
    expect(p.totalRepaid).toBe(100);
    expect(p.outstanding).toBe(1020);
  });

  it("no negative interest when asOf precedes disbursement", () => {
    const p = loanProjection(loan(), [], new Date("2025-01-01"));
    expect(p.accruedInterest).toBe(0);
    expect(p.outstanding).toBe(1000);
    expect(p.isOverdue).toBe(false);
  });

  it("COMPOUND_MONTHLY: months clamped to termMonths after the term", () => {
    const p = loanProjection(
      loan({ interestMethod: "COMPOUND_MONTHLY" }),
      [],
      new Date("2030-01-01"),
    );
    // months clamped to 12 -> 1000 * ((1.01)^12 - 1) = 126.825... -> 126.83
    expect(p.accruedInterest).toBe(126.83);
  });
});
