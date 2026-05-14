-- CreateTable
CREATE TABLE "mobile_app_releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "releaseNotes" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobile_app_releases_isPublished_idx" ON "mobile_app_releases"("isPublished");

-- CreateIndex
CREATE INDEX "mobile_app_releases_createdAt_idx" ON "mobile_app_releases"("createdAt");
