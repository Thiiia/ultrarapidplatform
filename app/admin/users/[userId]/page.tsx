import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getStudentDashboardData } from "@/lib/student-dashboard";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import StudentDashboard from "@/app/student/StudentDashboard";
import TeacherDashboard from "@/app/teacher/TeacherDashboard";

type AdminUserPreviewPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function AdminUserPreviewPage({
  params,
}: AdminUserPreviewPageProps) {
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

    return (
      <StudentDashboard
        dashboardData={dashboardData}
        navBasePath={`/admin/users/${targetUser.id}`}
      />
    );
  }

  if (targetUser.role === "teacher") {
    const dashboardData = await getTeacherDashboardData(targetUser.id);

    if (!dashboardData) {
      notFound();
    }

    return (
      <TeacherDashboard
        dashboardData={dashboardData}
        navBasePath={`/admin/users/${targetUser.id}`}
        adminViewing
        viewedUserName={targetUser.name}
        viewedUserEmail={targetUser.email}
      />
    );
  }

  redirect("/admin");
}