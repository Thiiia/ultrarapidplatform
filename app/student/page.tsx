import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
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

  return <StudentDashboard />;
}