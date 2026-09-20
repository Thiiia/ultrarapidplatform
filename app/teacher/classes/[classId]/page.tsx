import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import {
  getTeacherAssignableMissions,
  getTeacherClassStudents,
} from "@/lib/teacher-classes";
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

  const [classData, missions] = await Promise.all([
    getTeacherClassStudents({
      teacherId: user.id,
      classId,
    }),
    getTeacherAssignableMissions(user.id),
  ]);

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
        classId={classData.id}
        teacherId={user.id}
        missions={missions}
        className={classData.name}
        students={classData.students}
      />
    </TeacherSubpageShell>
  );
}
