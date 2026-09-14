import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getTeacherClassStudents } from "@/lib/teacher-classes";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";
import TeacherClassStudentsClient from "./TeacherClassStudentsClient";

export const dynamic = "force-dynamic";

type TeacherClassStudentsPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function TeacherClassStudentsPage({
  params,
}: TeacherClassStudentsPageProps) {
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

  const { classId } = await params;

  const classData = await getTeacherClassStudents({
    teacherId: user.id,
    classId,
  });

  if (!classData) {
    notFound();
  }

  return (
    <TeacherSubpageShell
      title="Classes"
      cards={[]}
      navBasePath="/teacher"
    >
      <TeacherClassStudentsClient
        className={classData.name}
        students={classData.students}
      />
    </TeacherSubpageShell>
  );
}
