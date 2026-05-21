import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import LessonBuilderClient from "@/app/student/lesson-builder/LessonBuilderClient";

export default async function TeacherLessonBuilderPage() {
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

  return <LessonBuilderClient navBasePath="/teacher" />;
}