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
            title: "No lessons yet",
            description:
              "Lessons from your teacher will appear here when they are ready.",
          },
          {
            title: "Keep going",
            description:
              "Lessons you start will appear here so you can pick up where you left off.",
          },
          {
            title: "Finished lessons",
            description:
              "Review the lessons you have finished.",
          },
        ];

  return <StudentSubpageShell title="My Lessons" cards={lessonCards.slice(0, 6)} />;
}
export const dynamic = "force-dynamic";
