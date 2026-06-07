import { notFound } from "next/navigation";
import { getTeacherClasses } from "@/lib/teacher-classes";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";
import TeacherClassesClient from "@/app/teacher/classes/TeacherClassesClient";

export const dynamic = "force-dynamic";

export default async function DemoTeacherClassesPage() {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;

  if (!demoTeacherUserId) {
    console.error("Missing DEMO_TEACHER_USER_ID environment variable.");
    notFound();
  }

  const classes = await getTeacherClasses(demoTeacherUserId);

  return (
    <TeacherSubpageShell
      title="Classes"
      cards={[]}
      navBasePath="/demo/teacher"
    >
      <TeacherClassesClient classes={classes} navBasePath="/demo/teacher" />
    </TeacherSubpageShell>
  );
}