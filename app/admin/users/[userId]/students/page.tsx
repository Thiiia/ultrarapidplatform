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

export default async function AdminTeacherStudentsPreviewPage({
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
            description: "Students assigned to this teacher will appear here.",
          },
        ];

  return (
    <TeacherSubpageShell
      title={`Students — ${targetUser.name ?? targetUser.email}`}
      cards={cards}
      navBasePath={`/admin/users/${targetUser.id}`}
    />
  );
}
export const dynamic = "force-dynamic";
