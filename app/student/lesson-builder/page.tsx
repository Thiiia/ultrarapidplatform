import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import LessonBuilderClient from "./LessonBuilderClient";

export default async function LessonBuilderPage() {
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

  return (
    <LessonBuilderClient
      studentName={user.name ?? "Student"}
    />
  );
}
