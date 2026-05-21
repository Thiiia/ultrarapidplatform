import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "../TeacherSubpageShell";

export default async function TeacherStudentsPage() {
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
    dashboardData.students.length > 0
      ? dashboardData.students.map((student) => ({
          title: student.name ?? student.email,
          description:
            student.classNames.length > 0
              ? student.classNames.join(", ")
              : "No class assigned",
        }))
      : [
          {
            title: "No students yet",
            description: "Students assigned to your classes will appear here.",
          },
        ];

  return <TeacherSubpageShell title="Students" cards={cards} />;
}