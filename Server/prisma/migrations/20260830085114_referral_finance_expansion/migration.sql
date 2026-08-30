-- CreateEnum
CREATE TYPE "RevenueCategory" AS ENUM ('HOSPITAL_REFERRAL_COMMISSION', 'OTHER_INCOME');

-- CreateEnum
CREATE TYPE "LoanInterestMethod" AS ENUM ('SIMPLE', 'COMPOUND_MONTHLY');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'SETTLED');

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('OUTSTANDING', 'SETTLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountTransactionType" ADD VALUE 'REVENUE_RECEIVED';
ALTER TYPE "AccountTransactionType" ADD VALUE 'LOAN_RECEIVED';
ALTER TYPE "AccountTransactionType" ADD VALUE 'LOAN_REPAYMENT';
ALTER TYPE "AccountTransactionType" ADD VALUE 'PAYABLE_SETTLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CaseEventType" ADD VALUE 'HOSPITAL_CHOSEN';
ALTER TYPE "CaseEventType" ADD VALUE 'HOSPITAL_CHANGED';

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'EVALUATION_DOC';

-- AlterEnum
ALTER TYPE "HospitalInquiryStatus" ADD VALUE 'NOT_SELECTED';

-- AlterTable
ALTER TABLE "AccountTransaction" ADD COLUMN     "loanId" TEXT,
ADD COLUMN     "loanRepaymentId" TEXT,
ADD COLUMN     "payableId" TEXT,
ADD COLUMN     "revenueId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "hospitalInquiryId" TEXT;

-- AlterTable
-- Added with a temporary default so existing Hospital rows survive, then the
-- default is dropped to match the schema (Hospital.country has no @default).
ALTER TABLE "Hospital" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE "Hospital" ALTER COLUMN "country" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HospitalInquiry" ADD COLUMN     "isChosen" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Revenue" (
    "id" TEXT NOT NULL,
    "category" "RevenueCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "description" TEXT,
    "receivedOn" TIMESTAMP(3) NOT NULL,
    "caseId" TEXT,
    "accountId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "principal" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "interestRatePct" DECIMAL(6,3) NOT NULL,
    "interestMethod" "LoanInterestMethod" NOT NULL,
    "disbursedOn" TIMESTAMP(3) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "accountId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "payeeName" TEXT NOT NULL,
    "caseId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "reason" TEXT NOT NULL,
    "raisedOn" TIMESTAMP(3) NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "settledOn" TIMESTAMP(3),
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransaction_revenueId_key" ON "AccountTransaction"("revenueId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransaction_loanId_key" ON "AccountTransaction"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransaction_loanRepaymentId_key" ON "AccountTransaction"("loanRepaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransaction_payableId_key" ON "AccountTransaction"("payableId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_hospitalInquiryId_fkey" FOREIGN KEY ("hospitalInquiryId") REFERENCES "HospitalInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revenue" ADD CONSTRAINT "Revenue_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revenue" ADD CONSTRAINT "Revenue_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revenue" ADD CONSTRAINT "Revenue_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_revenueId_fkey" FOREIGN KEY ("revenueId") REFERENCES "Revenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_loanRepaymentId_fkey" FOREIGN KEY ("loanRepaymentId") REFERENCES "LoanRepayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
