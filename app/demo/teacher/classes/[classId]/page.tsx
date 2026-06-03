import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeacherClassStudents } from "@/lib/teacher-classes";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";
import TeacherClassStudentsClient from "@/app/teacher/classes/[classId]/TeacherClassStudentsClient";

export const dynamic = "force-dynamic";

type DemoTeacherClassStudentsPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

async function getDemoTeacherUserId() {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;
  const demoTeacherEmail = process.env.DEMO_TEACHER_EMAIL;

  if (demoTeacherUserId) {
    return demoTeacherUserId;
  }

  if (!demoTeacherEmail) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: demoTeacherEmail,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role !== "teacher") {
    return null;
  }

  return user.id;
}

export default async function DemoTeacherClassStudentsPage({
  params,
}: DemoTeacherClassStudentsPageProps) {
  const demoTeacherUserId = await getDemoTeacherUserId();

  if (!demoTeacherUserId) {
    notFound();
  }

  const { classId } = await params;

  const classData = await getTeacherClassStudents({
    teacherId: demoTeacherUserId,
    classId,
  });

  if (!classData) {
    notFound();
  }

  return (
    <TeacherSubpageShell
      title="Classes"
      cards={[]}
      navBasePath="/demo/teacher"
    >
      <TeacherClassStudentsClient
        className={classData.name}
        students={classData.students}
      />
    </TeacherSubpageShell>
  );
}