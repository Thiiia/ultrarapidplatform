import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getStudentDashboardData } from "@/lib/student-dashboard";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import { prisma } from "@/lib/prisma";
import StudentSubpageShell from "@/app/student/StudentSubpageShell";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

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

export default async function AdminLessonsPreviewPage({
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

  if (!targetUser) {
    notFound();
  }

  if (targetUser.role === "student") {
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

  if (targetUser.role === "teacher") {
    const dashboardData = await getTeacherDashboardData(targetUser.id);

    if (!dashboardData) {
      notFound();
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
              description: "Lessons this teacher creates or authors will appear here.",
            },
          ];

    return (
      <TeacherSubpageShell
        title={`Lessons — ${targetUser.name ?? targetUser.email}`}
        cards={cards}
        navBasePath={`/admin/users/${targetUser.id}`}
      />
    );
  }

  notFound();
}
export const dynamic = "force-dynamic";
