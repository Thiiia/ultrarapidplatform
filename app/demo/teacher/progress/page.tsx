import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeacherClasses } from "@/lib/teacher-classes";
import { getClassStudentActivity } from "@/lib/teacher-progress";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";
import TeacherProgressClient from "@/app/teacher/progress/TeacherProgressClient";

export const dynamic = "force-dynamic";

async function getDemoTeacherUserId() {
  const demoTeacherUserId = process.env.DEMO_TEACHER_USER_ID;
  const demoTeacherEmail = process.env.DEMO_TEACHER_EMAIL;

  if (demoTeacherUserId) return demoTeacherUserId;
  if (!demoTeacherEmail) return null;

  const user = await prisma.user.findUnique({
    where: { email: demoTeacherEmail },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "teacher") return null;

  return user.id;
}

type DemoTeacherProgressPageProps = {
  searchParams: Promise<{ classId?: string }>;
};

export default async function DemoTeacherProgressPage({
  searchParams,
}: DemoTeacherProgressPageProps) {
  const demoTeacherUserId = await getDemoTeacherUserId();

  if (!demoTeacherUserId) {
    notFound();
  }

  const classes = await getTeacherClasses(demoTeacherUserId);
  const { classId } = await searchParams;
  const effectiveClassId = classes.length === 1 ? classes[0].id : classId;

  const selectedClass = effectiveClassId
    ? await getClassStudentActivity({ teacherId: demoTeacherUserId, classId: effectiveClassId })
    : null;

  return (
    <TeacherSubpageShell title="Progress" cards={[]} navBasePath="/demo/teacher">
      <TeacherProgressClient
        classes={classes}
        selectedClass={selectedClass}
        navBasePath="/demo/teacher"
      />
    </TeacherSubpageShell>
  );
}