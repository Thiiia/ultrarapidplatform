import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import TeacherDashboard from "./TeacherDashboard";

export default async function TeacherPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role !== "teacher") {
    redirect("/student");
  }

  return <TeacherDashboard />;
}