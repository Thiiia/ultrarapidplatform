import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "../TeacherSubpageShell";

export default async function TeacherClassesPage() {
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

  const cards =
    dashboardData.classes.length > 0
      ? dashboardData.classes.map((classItem) => ({
          title: classItem.name,
          description: `${classItem.studentCount} student${
            classItem.studentCount === 1 ? "" : "s"
          } • ${classItem.assignments.length} assignment${
            classItem.assignments.length === 1 ? "" : "s"
          }`,
        }))
      : [
          {
            title: "No classes yet",
            description: "Classes assigned to you will appear here.",
          },
        ];

  return <TeacherSubpageShell title="Classes" cards={cards} />;
}