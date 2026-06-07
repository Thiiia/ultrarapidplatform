import { notFound } from "next/navigation";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherDashboard from "@/app/teacher/TeacherDashboard";

export const dynamic = "force-dynamic";

export default async function DemoTeacherPage() {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;

  if (!demoTeacherUserId) {
    console.error("Missing DEMO_TEACHER_USER_ID environment variable.");
    notFound();
  }

  const dashboardData = await getTeacherDashboardData(demoTeacherUserId);

  if (!dashboardData) {
    console.error("No teacher dashboard data found for DEMO_TEACHER_USER_ID.");
    notFound();
  }

  return (
    <TeacherDashboard
      dashboardData={dashboardData}
      navBasePath="/demo/teacher"
      demoTutorial
    />
  );
}