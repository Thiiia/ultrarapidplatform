import { notFound } from "next/navigation";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";

export const dynamic = "force-dynamic";

export default async function DemoTeacherAssignmentsPage() {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;

  if (!demoTeacherUserId) {
    console.error("Missing DEMO_TEACHER_USER_ID environment variable.");
    notFound();
  }

  const dashboardData = await getTeacherDashboardData(demoTeacherUserId);

  if (!dashboardData) {
    console.error("No teacher dashboard data found for DEMO_TEACHER_USER_ID.");
    notFound();
  }

  const cards = dashboardData.classes.flatMap((classItem) =>
    classItem.assignments.map((assignment) => ({
      title: assignment.missionTitle,
      description: `${assignment.studentName ?? classItem.name} • ${assignment.status.replace("_", " ")}`,
      href: `/demo/teacher/classes/${classItem.id}`,
    })),
  );

  return (
    <TeacherSubpageShell
      title="Assignments"
      cards={cards}
      navBasePath="/demo/teacher"
    />
  );
}
