import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";

export const dynamic = "force-dynamic";

async function getDemoTeacherUserId() {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;
  const demoTeacherEmail = process.env.DEMO_TEACHER_EMAIL;

  if (demoTeacherUserId) return demoTeacherUserId;
  if (!demoTeacherEmail) return null;

  const user = await prisma.user.findUnique({
    where: { email: demoTeacherEmail },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "teacher") return null;

  return user.id;
}

export default async function DemoTeacherProgressPage() {
  const demoTeacherUserId = await getDemoTeacherUserId();

  if (!demoTeacherUserId) {
    notFound();
  }

  const dashboardData = await getTeacherDashboardData(demoTeacherUserId);

  if (!dashboardData) {
    notFound();
  }

  const assignedCount = dashboardData.classes.reduce((total, classItem) => {
    return (
      total +
      classItem.assignments.filter((assignment) => assignment.status === "assigned")
        .length
    );
  }, 0);

  const inProgressCount = dashboardData.classes.reduce((total, classItem) => {
    return (
      total +
      classItem.assignments.filter(
        (assignment) => assignment.status === "in_progress",
      ).length
    );
  }, 0);

  const completedCount = dashboardData.classes.reduce((total, classItem) => {
    return (
      total +
      classItem.assignments.filter((assignment) => assignment.status === "completed")
        .length
    );
  }, 0);

  return (
    <TeacherSubpageShell
      title="Progress"
      navBasePath="/demo/teacher"
      cards={[
        {
          title: "Assigned",
          description: `${assignedCount} assignment${
            assignedCount === 1 ? "" : "s"
          } waiting to be started.`,
        },
        {
          title: "In Progress",
          description: `${inProgressCount} assignment${
            inProgressCount === 1 ? "" : "s"
          } currently in progress.`,
        },
        {
          title: "Completed",
          description: `${completedCount} assignment${
            completedCount === 1 ? "" : "s"
          } completed.`,
        },
      ]}
    />
  );
}