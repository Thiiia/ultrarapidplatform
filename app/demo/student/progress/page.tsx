import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudentSubpageShell from "@/app/student/StudentSubpageShell";

export const dynamic = "force-dynamic";

async function getDemoStudentUserId() {
  const demoStudentUserId = process.env.DEMO_STUDENT_USER_ID;
  const demoStudentEmail = process.env.DEMO_STUDENT_EMAIL;

  if (demoStudentUserId) return demoStudentUserId;
  if (!demoStudentEmail) return null;

  const user = await prisma.user.findUnique({
    where: { email: demoStudentEmail },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "student") return null;

  return user.id;
}

export default async function DemoStudentProgressPage() {
  const demoStudentUserId = await getDemoStudentUserId();

  if (!demoStudentUserId) {
    notFound();
  }

  const progressRecords = await prisma.progress.findMany({
    where: {
      userId: demoStudentUserId,
    },
    include: {
      mission: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 6,
  });

  const completedCount = progressRecords.filter(
    (record) => record.status === "complete",
  ).length;

  const inProgressCount = progressRecords.filter(
    (record) => record.status === "in_progress",
  ).length;

  const averageScore =
    progressRecords.length > 0
      ? Math.round(
          progressRecords.reduce((total, record) => total + record.score, 0) /
            progressRecords.length,
        )
      : 0;

  return (
    <StudentSubpageShell
      title="Progress"
      navBasePath="/demo/student"
      cards={[
        {
          title: "Lessons finished",
          description: `${completedCount} lesson${
            completedCount === 1 ? "" : "s"
          } completed recently.`,
        },
        {
          title: "Keep going",
          description: `${inProgressCount} lesson${
            inProgressCount === 1 ? "" : "s"
          } currently in progress.`,
        },
        {
          title: "Average Score",
          description:
            progressRecords.length > 0
              ? `${averageScore}% average across recent lessons.`
              : "Finish a lesson to see your practice here.",
        },
      ]}
    />
  );
}
