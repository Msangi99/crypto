-- CreateTable
CREATE TABLE "user_mining_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "payoutAddress" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mining_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_mining_subscriptions_userId_key" ON "user_mining_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "user_mining_subscriptions_packageId_idx" ON "user_mining_subscriptions"("packageId");

-- AddForeignKey
ALTER TABLE "user_mining_subscriptions" ADD CONSTRAINT "user_mining_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mining_subscriptions" ADD CONSTRAINT "user_mining_subscriptions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "clb_mining_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
