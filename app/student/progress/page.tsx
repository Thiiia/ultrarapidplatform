import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import StudentSubpageShell from "../StudentSubpageShell";

export default async function ProgressPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role !== "student") {
    redirect("/teacher");
  }

  const progressRecords = await prisma.progress.findMany({
    where: {
      userId: user.id,
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
      title="Progress"
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
              : "Scores will appear here after you complete lessons.",
        },
      ]}
    />
  );
}