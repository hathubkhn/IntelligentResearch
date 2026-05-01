-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable User: add subscription/usage columns
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "plan"                 "Plan"       NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "discoverUsage"        INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discoverUsageResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"                     TEXT        NOT NULL,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"                 TEXT        NOT NULL,
  "provider"               TEXT        NOT NULL,
  "providerSubscriptionId" TEXT        NOT NULL,
  "status"                 TEXT        NOT NULL,
  "billingCycle"           "BillingCycle" NOT NULL,
  "currentPeriodStart"     TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key"
  ON "Subscription"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_providerSubscriptionId_key"
  ON "Subscription"("providerSubscriptionId");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;
