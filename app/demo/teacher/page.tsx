import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherDashboard from "@/app/teacher/TeacherDashboard";

export const dynamic = "force-dynamic";

async function getDemoTeacherUserId() {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;
  const demoTeacherEmail = process.env.DEMO_TEACHER_EMAIL;

  if (demoTeacherUserId) {
    return demoTeacherUserId;
  }

  if (!demoTeacherEmail) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: demoTeacherEmail,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role !== "teacher") {
    return null;
  }

  return user.id;
}

export default async function DemoTeacherPage() {
  const demoTeacherUserId = await getDemoTeacherUserId();

  if (!demoTeacherUserId) {
    notFound();
  }

  const dashboardData = await getTeacherDashboardData(demoTeacherUserId);

  if (!dashboardData) {
    notFound();
  }

  return (
    <TeacherDashboard
      dashboardData={dashboardData}
      navBasePath="/demo/teacher"
    />
  );
}