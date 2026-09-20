import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherClasses } from "@/lib/teacher-classes";
import { getClassStudentActivity } from "@/lib/teacher-progress";
import TeacherSubpageShell from "../TeacherSubpageShell";
import TeacherProgressClient from "./TeacherProgressClient";

export const dynamic = "force-dynamic";

type TeacherProgressPageProps = {
  searchParams: Promise<{ classId?: string }>;
};

export default async function TeacherProgressPage({
  searchParams,
}: TeacherProgressPageProps) {
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
  const { classId } = await searchParams;
  const effectiveClassId = classes.length === 1 ? classes[0].id : classId;

  const selectedClass = effectiveClassId
    ? await getClassStudentActivity({ teacherId: user.id, classId: effectiveClassId })
    : null;

  return (
    <TeacherSubpageShell title="Progress" cards={[]} navBasePath="/teacher">
      <TeacherProgressClient
        classes={classes}
        selectedClass={selectedClass}
        navBasePath="/teacher"
      />
    </TeacherSubpageShell>
  );
}

