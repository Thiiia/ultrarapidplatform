import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getStudentDashboardData,
  getStudentLessonDetail,
} from "@/lib/student-dashboard";
import StudentSubpageShell from "@/app/student/StudentSubpageShell";
import StudentLessonDetail from "@/app/student/lessons/StudentLessonDetail";

export const dynamic = "force-dynamic";

type DemoStudentLessonsPageProps = {
  searchParams: Promise<{
    assignmentId?: string | string[];
    missionId?: string | string[];
  }>;
};

async function getDemoStudentUserId() {
  const demoStudentUserId = process.env.DEMO_STUDENT_USER_ID;
  const demoStudentEmail = process.env.DEMO_STUDENT_EMAIL;

  if (demoStudentUserId) return demoStudentUserId;
  if (!demoStudentEmail) return null;

  const user = await prisma.user.findUnique({
    where: { email: demoStudentEmail },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "student") return null;

  return user.id;
}

export default async function DemoStudentLessonsPage({
  searchParams,
}: DemoStudentLessonsPageProps) {
  const query = await searchParams;
  const assignmentId = typeof query.assignmentId === "string" ? query.assignmentId : null;
  const missionId = typeof query.missionId === "string" ? query.missionId : null;

  if (assignmentId && missionId) notFound();

  const demoStudentUserId = await getDemoStudentUserId();

  if (!demoStudentUserId) {
    notFound();
  }

  if (assignmentId || missionId) {
    const detail = await getStudentLessonDetail(demoStudentUserId, {
      assignmentId,
      missionId,
    });

    if (!detail) notFound();

    return (
      <StudentSubpageShell title="My Lessons" cards={[]} navBasePath="/demo/student">
        <StudentLessonDetail detail={detail} navBasePath="/demo/student" />
      </StudentSubpageShell>
    );
  }

  const dashboardData = await getStudentDashboardData(demoStudentUserId, {
    navBasePath: "/demo/student",
  });

  if (!dashboardData) {
    notFound();
  }

  const cards =
    dashboardData.currentLessons.length > 0
      ? dashboardData.currentLessons.map((lesson) => ({
          title: lesson.title,
          description: `${lesson.className ?? "Current lesson"} • ${
            lesson.teacherName ?? "Self-paced"
          }`,
          href: lesson.href,
        }))
      : [
          {
            title: "No lessons yet",
            description: "Lessons will appear here when they are ready.",
          },
          {
            title: "Keep going",
            description: "Lessons you start will appear here.",
          },
          {
            title: "Finished lessons",
            description: "Review the lessons you have finished.",
          },
        ];

  return (
    <StudentSubpageShell
      title="My Lessons"
      cards={cards.slice(0, 6)}
      navBasePath="/demo/student"
    />
  );
}
