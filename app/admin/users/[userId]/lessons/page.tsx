import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getStudentDashboardData } from "@/lib/student-dashboard";
import { prisma } from "@/lib/prisma";
import StudentSubpageShell from "@/app/student/StudentSubpageShell";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function AdminStudentLessonsPreviewPage({
  params,
}: PageProps) {
  const adminUser = await getCurrentAppUser();

  if (!adminUser) {
    redirect("/login");
  }

  if (adminUser.role !== "admin") {
    redirect(`/${adminUser.role}`);
  }

  const { userId } = await params;

  const targetUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!targetUser || targetUser.role !== "student") {
    notFound();
  }

  const dashboardData = await getStudentDashboardData(targetUser.id);

  if (!dashboardData) {
    notFound();
  }

  const lessonCards =
    dashboardData.currentLessons.length > 0
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
            description: "This student does not have any assigned lessons yet.",
          },
          {
            title: "In Progress",
            description: "Lessons this student starts will appear here.",
          },
          {
            title: "Completed",
            description: "Finished lessons will appear here for review.",
          },
        ];

  return (
    <StudentSubpageShell
      title={`My Lessons — ${targetUser.name ?? targetUser.email}`}
      cards={lessonCards.slice(0, 6)}
      navBasePath={`/admin/users/${targetUser.id}`}
    />
  );
}