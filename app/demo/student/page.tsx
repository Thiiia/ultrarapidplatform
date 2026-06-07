import { notFound } from "next/navigation";
import { getStudentDashboardData } from "@/lib/student-dashboard";
import StudentDashboard from "@/app/student/StudentDashboard";

export const dynamic = "force-dynamic";

export default async function DemoStudentPage() {
  const demoStudentUserId = process.env.DEMO_STUDENT_USER_ID;

  if (!demoStudentUserId) {
    console.error("Missing DEMO_STUDENT_USER_ID environment variable.");
    notFound();
  }

  const dashboardData = await getStudentDashboardData(demoStudentUserId);

  if (!dashboardData) {
    console.error("No student dashboard data found for DEMO_STUDENT_USER_ID.");
    notFound();
  }

  return (
    <StudentDashboard
      dashboardData={dashboardData}
      navBasePath="/demo/student"
    />
  );
}