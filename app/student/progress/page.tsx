import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import StudentSubpageShell from "../StudentSubpageShell";
import UnityRunHistory from "./UnityRunHistory";

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

  const [progressRecords, unityOutcomes] = await Promise.all([
    prisma.progress.findMany({
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
    }),
    prisma.playerRunOutcome.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        launchAttemptId: true,
        outcome: true,
        completionVersion: true,
        missionSteps: true,
        createdAt: true,
        launchAttempt: {
          select: {
            activityKey: true,
            songAssetId: true,
          },
        },
      },
    }),
  ]);

  const songAssetIds = Array.from(new Set(
    unityOutcomes.map((outcome) => outcome.launchAttempt.songAssetId),
  ));
  const songAssets = await prisma.songAsset.findMany({
    where: { id: { in: songAssetIds } },
    select: { id: true, title: true },
  });
  const songTitleById = new Map(songAssets.map((song) => [song.id, song.title]));
  const recentUnityRuns = unityOutcomes.map((outcome) => ({
    launchAttemptId: outcome.launchAttemptId,
    activityKey: outcome.launchAttempt.activityKey,
    songTitle: songTitleById.get(outcome.launchAttempt.songAssetId) ?? null,
    outcome: outcome.outcome,
    completionVersion: outcome.completionVersion,
    missionSteps: outcome.missionSteps,
    createdAt: outcome.createdAt,
  }));

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
          title: "Lessons finished",
          description: `${completedCount} lesson${
            completedCount === 1 ? "" : "s"
          } completed recently.`,
        },
        {
          title: "Keep going",
          description: `${inProgressCount} lesson${
            inProgressCount === 1 ? "" : "s"
          } currently in progress.`,
        },
        {
          title: "Lesson practice score",
          description:
            progressRecords.length > 0
              ? `${averageScore}% average across recent lessons.`
              : "Finish a lesson to see your practice here.",
        },
      ]}
    >
      <UnityRunHistory runs={recentUnityRuns} />
    </StudentSubpageShell>
  );
}
export const dynamic = "force-dynamic";
