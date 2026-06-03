import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherClasses } from "@/lib/teacher-classes";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";
import TeacherClassesClient from "./TeacherClassesClient";

export const dynamic = "force-dynamic";

export default async function TeacherClassesPage() {
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

  const classes = await getTeacherClasses(user.id);

  return (
    <TeacherSubpageShell
      title="Classes"
      cards={[]}
      navBasePath="/teacher"
    >
      <TeacherClassesClient classes={classes} navBasePath="/teacher" />
    </TeacherSubpageShell>
  );
}