-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'CASE_DOCUMENT';

-- AlterTable
ALTER TABLE "Attendant" ALTER COLUMN "passportNumber" DROP NOT NULL,
ALTER COLUMN "passportExpiry" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "passportNumber" DROP NOT NULL,
ALTER COLUMN "passportExpiry" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
