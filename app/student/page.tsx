import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getStudentDashboardData } from "@/lib/student-dashboard";
import StudentDashboard from "./StudentDashboard";

export default async function StudentPage() {
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

  if (!dashboardData) {
    redirect("/login");
  }

  return <StudentDashboard dashboardData={dashboardData} />;
}
export const dynamic = "force-dynamic";
