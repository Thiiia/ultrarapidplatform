import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";

export const dynamic = "force-dynamic";

async function getDemoTeacherUserId() {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;
  const demoTeacherEmail = process.env.DEMO_TEACHER_EMAIL;

  if (demoTeacherUserId) {
    return demoTeacherUserId;
  }

  if (!demoTeacherEmail) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: demoTeacherEmail,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role !== "teacher") {
    return null;
  }

  return user.id;
}

export default async function DemoTeacherClassesPage() {
  const demoTeacherUserId = await getDemoTeacherUserId();

  if (!demoTeacherUserId) {
    notFound();
  }

  const dashboardData = await getTeacherDashboardData(demoTeacherUserId);

  if (!dashboardData) {
    notFound();
  }

  const cards =
    dashboardData.classes.length > 0
      ? dashboardData.classes.map((classItem) => ({
          title: classItem.name,
          description: `${classItem.studentCount} student${
            classItem.studentCount === 1 ? "" : "s"
          } • ${classItem.assignments.length} assignment${
            classItem.assignments.length === 1 ? "" : "s"
          }`,
          href: `/demo/teacher/classes/${classItem.id}`,
        }))
      : [
          {
            title: "No classes assigned yet",
            description:
              "Once this demo teacher is assigned to classes, they will appear here.",
          },
        ];

  return (
    <TeacherSubpageShell
      title="Classes"
      cards={cards}
      navBasePath="/demo/teacher"
    />
  );
}