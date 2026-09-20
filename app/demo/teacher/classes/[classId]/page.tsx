import { notFound } from "next/navigation";
import {
  getTeacherAssignableMissions,
  getTeacherClassStudents,
} from "@/lib/teacher-classes";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";
import TeacherClassStudentsClient from "@/app/teacher/classes/[classId]/TeacherClassStudentsClient";

export const dynamic = "force-dynamic";

type DemoTeacherClassStudentsPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function DemoTeacherClassStudentsPage({
  params,
}: DemoTeacherClassStudentsPageProps) {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;

  if (!demoTeacherUserId) {
    console.error("Missing DEMO_TEACHER_USER_ID environment variable.");
    notFound();
  }

  const { classId } = await params;

  const [classData, missions] = await Promise.all([
    getTeacherClassStudents({
      teacherId: demoTeacherUserId,
      classId,
    }),
    getTeacherAssignableMissions(demoTeacherUserId),
  ]);

  if (!classData) {
    console.error("No class data found for demo teacher/class combination.");
    notFound();
  }

  return (
    <TeacherSubpageShell
      title="Classes"
      cards={[]}
      navBasePath="/demo/teacher"
    >
      <TeacherClassStudentsClient
        classId={classData.id}
        teacherId={demoTeacherUserId}
        missions={missions}
        isDemo
        className={classData.name}
        students={classData.students}
      />
    </TeacherSubpageShell>
  );
}