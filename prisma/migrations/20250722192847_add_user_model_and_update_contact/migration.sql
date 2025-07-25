-- AlterTable
ALTER TABLE "ContactSubmission" ADD COLUMN "assignedTo" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "budget" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "company" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "heardFrom" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "newsletter" BOOLEAN DEFAULT false;
ALTER TABLE "ContactSubmission" ADD COLUMN "phone" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "projectType" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "timeline" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "userAgent" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLogin" DATETIME,
    "bio" TEXT,
    "website" TEXT,
    "company" TEXT,
    "position" TEXT,
    "location" TEXT,
    "phone" TEXT,
    "socialLinks" TEXT,
    "preferences" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
