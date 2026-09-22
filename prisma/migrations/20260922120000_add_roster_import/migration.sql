-- Allow school roster records to exist before the user first signs in.
ALTER TABLE "User" ALTER COLUMN "auth0Sub" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "normalizedEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Class" ADD COLUMN "externalId" TEXT;

CREATE TYPE "RosterImportMode" AS ENUM ('additive', 'reconcile');
CREATE TYPE "RosterImportStatus" AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE "RosterImport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mode" "RosterImportMode" NOT NULL DEFAULT 'additive',
    "status" "RosterImportStatus" NOT NULL DEFAULT 'pending',
    "summaryJson" JSONB,
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "RosterImport_pkey" PRIMARY KEY ("id")
);

UPDATE "User" SET "normalizedEmail" = LOWER(TRIM("email"));
ALTER TABLE "User" ALTER COLUMN "normalizedEmail" SET NOT NULL;

CREATE UNIQUE INDEX "User_normalizedEmail_key" ON "User"("normalizedEmail");
CREATE UNIQUE INDEX "User_schoolId_externalId_key" ON "User"("schoolId", "externalId");
CREATE UNIQUE INDEX "Class_schoolId_externalId_key" ON "Class"("schoolId", "externalId");
CREATE INDEX "RosterImport_schoolId_createdAt_idx" ON "RosterImport"("schoolId", "createdAt");
CREATE INDEX "RosterImport_uploadedById_idx" ON "RosterImport"("uploadedById");

ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The Prisma model already describes this relation; create the missing table.
CREATE TABLE "TeacherClass" (
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherClass_pkey" PRIMARY KEY ("teacherId", "classId")
);

CREATE INDEX "TeacherClass_teacherId_idx" ON "TeacherClass"("teacherId");
CREATE INDEX "TeacherClass_classId_idx" ON "TeacherClass"("classId");
ALTER TABLE "TeacherClass" ADD CONSTRAINT "TeacherClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherClass" ADD CONSTRAINT "TeacherClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;