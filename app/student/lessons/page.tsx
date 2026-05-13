import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getStudentDashboardData } from "@/lib/student-dashboard";
import StudentSubpageShell from "../StudentSubpageShell";

export default async function MyLessonsPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role !== "student") {
    redirect("/teacher");
  }

  const dashboardData = await getStudentDashboardData(user.id);

  const lessonCards =
    dashboardData?.currentLessons.length && dashboardData.currentLessons.length > 0
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
            description:
              "Your assigned lessons will appear here after your teacher adds you to a class and assigns work.",
          },
          {
            title: "In Progress",
            description:
              "Lessons you start will appear here so you can continue where you left off.",
          },
          {
            title: "Completed",
            description:
              "Finished lessons will appear here for review and progress tracking.",
          },
        ];

  return <StudentSubpageShell title="My Lessons" cards={lessonCards.slice(0, 6)} />;
}