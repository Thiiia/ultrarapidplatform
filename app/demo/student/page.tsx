import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStudentDashboardData } from "@/lib/student-dashboard";
import StudentDashboard from "@/app/student/StudentDashboard";

export const dynamic = "force-dynamic";

async function getDemoStudentUserId() {
  const demoStudentUserId = process.env.DEMO_STUDENT_USER_ID;
  const demoStudentEmail = process.env.DEMO_STUDENT_EMAIL;

  if (demoStudentUserId) {
    return demoStudentUserId;
  }

  if (!demoStudentEmail) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: demoStudentEmail,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role !== "student") {
    return null;
  }

  return user.id;
}

export default async function DemoStudentPage() {
  const demoStudentUserId = await getDemoStudentUserId();

  if (!demoStudentUserId) {
    notFound();
  }

  const dashboardData = await getStudentDashboardData(demoStudentUserId);

  if (!dashboardData) {
    notFound();
  }

  return (
    <StudentDashboard
      dashboardData={dashboardData}
      navBasePath="/demo/student"
    />
  );
}