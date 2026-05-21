import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "../TeacherSubpageShell";

export default async function TeacherProgressPage() {
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

  const assignedCount = dashboardData.classes.reduce((total, classItem) => {
    return (
      total +
      classItem.assignments.filter((assignment) => assignment.status === "assigned").length
    );
  }, 0);

  const inProgressCount = dashboardData.classes.reduce((total, classItem) => {
    return (
      total +
      classItem.assignments.filter((assignment) => assignment.status === "in_progress").length
    );
  }, 0);

  const completedCount = dashboardData.classes.reduce((total, classItem) => {
    return (
      total +
      classItem.assignments.filter((assignment) => assignment.status === "completed").length
    );
  }, 0);

  return (
    <TeacherSubpageShell
      title="Progress"
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