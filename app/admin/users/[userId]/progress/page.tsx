import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import TeacherSubpageShell from "@/app/teacher/TeacherSubpageShell";
import StudentSubpageShell from "@/app/student/StudentSubpageShell";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function AdminProgressPreviewPage({
  params,
}: PageProps) {
  const adminUser = await getCurrentAppUser();

  if (!adminUser) {
    redirect("/login");
  }

  if (adminUser.role !== "admin") {
    redirect(`/${adminUser.role}`);
  }

  const { userId } = await params;

  const targetUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!targetUser) {
    notFound();
  }

  if (targetUser.role === "student") {
    const progressRecords = await prisma.progress.findMany({
      where: {
        userId: targetUser.id,
      },
      include: {
        mission: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 6,
    });

    const completedCount = progressRecords.filter(
      (record) => record.status === "complete",
    ).length;

    const inProgressCount = progressRecords.filter(
      (record) => record.status === "in_progress",
    ).length;

    const averageScore =
      progressRecords.length > 0
        ? Math.round(
            progressRecords.reduce((total, record) => total + record.score, 0) /
              progressRecords.length,
          )
        : 0;

    return (
      <StudentSubpageShell
        title={`Progress — ${targetUser.name ?? targetUser.email}`}
        navBasePath={`/admin/users/${targetUser.id}`}
        cards={[
          {
            title: "Completed Lessons",
            description: `${completedCount} lesson${
              completedCount === 1 ? "" : "s"
            } completed recently.`,
          },
          {
            title: "In Progress",
            description: `${inProgressCount} lesson${
              inProgressCount === 1 ? "" : "s"
            } currently in progress.`,
          },
          {
            title: "Average Score",
            description:
              progressRecords.length > 0
                ? `${averageScore}% average across recent lessons.`
                : "Scores will appear here after this student completes lessons.",
          },
        ]}
      />
    );
  }

  if (targetUser.role === "teacher") {
    const dashboardData = await getTeacherDashboardData(targetUser.id);

    if (!dashboardData) {
      notFound();
    }

    const assignedCount = dashboardData.classes.reduce((total, classItem) => {
      return (
        total +
        classItem.assignments.filter((assignment) => assignment.status === "assigned")
          .length
      );
    }, 0);

    const inProgressCount = dashboardData.classes.reduce((total, classItem) => {
      return (
        total +
        classItem.assignments.filter(
          (assignment) => assignment.status === "in_progress",
        ).length
      );
    }, 0);

    const completedCount = dashboardData.classes.reduce((total, classItem) => {
      return (
        total +
        classItem.assignments.filter((assignment) => assignment.status === "completed")
          .length
      );
    }, 0);

    return (
      <TeacherSubpageShell
        title={`Progress — ${targetUser.name ?? targetUser.email}`}
        navBasePath={`/admin/users/${targetUser.id}`}
        cards={[
          {
            title: "Assigned",
            description: `${assignedCount} assignment${
              assignedCount === 1 ? "" : "s"
            } waiting to be started.`,
          },
          {
            title: "In Progress",
            description: `${inProgressCount} assignment${
              inProgressCount === 1 ? "" : "s"
            } currently in progress.`,
          },
          {
            title: "Completed",
            description: `${completedCount} assignment${
              completedCount === 1 ? "" : "s"
            } completed.`,
          },
        ]}
      />
    );
  }

  notFound();
}