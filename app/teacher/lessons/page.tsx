import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "../TeacherSubpageShell";

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "No date";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default async function TeacherLessonsPage() {
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
    dashboardData.authoredMissions.length > 0
      ? dashboardData.authoredMissions.map((mission) => ({
          title: mission.title,
          description: `${mission.published ? "Published" : "Draft"} • Updated ${formatDate(
            mission.updatedAt,
          )}`,
        }))
      : [
          {
            title: "No lessons yet",
            description: "Lessons you create or author will appear here.",
          },
        ];

  return <TeacherSubpageShell title="Lessons" cards={cards} />;
}