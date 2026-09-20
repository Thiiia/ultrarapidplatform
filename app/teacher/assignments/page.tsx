import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role !== "teacher") {
    redirect("/student");
  }

  const dashboardData = await getTeacherDashboardData(user.id);

  if (!dashboardData) {
    redirect("/login");
  }

  const cards = dashboardData.classes.flatMap((classItem) =>
    classItem.assignments.map((assignment) => ({
      title: assignment.missionTitle,
      description: `${assignment.studentName ?? classItem.name} • ${assignment.status.replace("_", " ")}`,
      href: `/teacher/classes/${classItem.id}`,
    })),
  );

  return (
    <TeacherSubpageShell title="Assignments" cards={cards} navBasePath="/teacher" />
  );
}
