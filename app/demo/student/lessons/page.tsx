import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStudentDashboardData } from "@/lib/student-dashboard";
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

export default async function DemoStudentLessonsPage() {
  const demoStudentUserId = await getDemoStudentUserId();

  if (!demoStudentUserId) {
    notFound();
  }

  const dashboardData = await getStudentDashboardData(demoStudentUserId);

  if (!dashboardData) {
    notFound();
  }

  const cards =
    dashboardData.currentLessons.length > 0
      ? dashboardData.currentLessons.map((lesson) => ({
          title: lesson.title,
          description: `${lesson.className ?? "Current lesson"} • ${
            lesson.teacherName ?? "Self-paced"
          }`,
          href: lesson.href,
        }))
      : [
          {
            title: "No Assigned Lessons",
            description: "This demo student does not have any assigned lessons yet.",
          },
          {
            title: "In Progress",
            description: "Lessons this student starts will appear here.",
          },
          {
            title: "Completed",
            description: "Finished lessons will appear here for review.",
          },
        ];

  return (
    <StudentSubpageShell
      title="My Lessons"
      cards={cards.slice(0, 6)}
      navBasePath="/demo/student"
    />
  );
}