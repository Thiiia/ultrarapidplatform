import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";

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

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date";

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default async function DemoTeacherLessonsPage() {
  const demoTeacherUserId = await getDemoTeacherUserId();

  if (!demoTeacherUserId) {
    notFound();
  }

  const dashboardData = await getTeacherDashboardData(demoTeacherUserId);

  if (!dashboardData) {
    notFound();
  }

  const cards =
    dashboardData.authoredMissions.length > 0
      ? dashboardData.authoredMissions.map((mission) => ({
          title: mission.title,
          description: `${mission.published ? "Published" : "Draft"} • Updated ${formatDate(
            mission.updatedAt,
          )}`,
        }))
      : [
          {
            title: "No lessons yet",
            description: "Lessons this teacher creates or authors will appear here.",
          },
        ];

  return (
    <TeacherSubpageShell
      title="My Lessons"
      cards={cards}
      navBasePath="/demo/teacher"
    />
  );
}