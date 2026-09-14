import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import { prisma } from "@/lib/prisma";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function AdminTeacherClassesPreviewPage({
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

  if (!targetUser || targetUser.role !== "teacher") {
    notFound();
  }

  const dashboardData = await getTeacherDashboardData(targetUser.id);

  if (!dashboardData) {
    notFound();
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
            description: "Classes assigned to this teacher will appear here.",
          },
        ];

  return (
    <TeacherSubpageShell
      title={`Classes — ${targetUser.name ?? targetUser.email}`}
      cards={cards}
      navBasePath={`/admin/users/${targetUser.id}`}
    />
  );
}
export const dynamic = "force-dynamic";
