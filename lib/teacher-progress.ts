import { prisma } from "@/lib/prisma";

export type StudentActivityStat = {
  activityKey: string;
  attempts: number;
};

export type StudentProgressSummary = {
  id: string;
  name: string;
  email: string;
  schoolName: string | null;
  lastLoginAt: Date | null;
  totalAttempts: number;
  attemptsByActivity: StudentActivityStat[];
  accuracyPercent: number | null;
  completedCount: number;
  failedCount: number;
  lastPlayed: {
    activityKey: string;
    songTitle: string;
    playedAt: Date;
  } | null;
};

/**
 * Aggregates each student's website/game usage (launch attempts, accuracy,
 * last played game) for a teacher's class roster, using the existing
 * PlayerLaunchAttempt/PlayerRunOutcome tracking tables.
 */
export async function getClassStudentActivity({
  teacherId,
  classId,
}: {
  teacherId: string;
  classId: string;
}): Promise<{ id: string; name: string; students: StudentProgressSummary[] } | null> {
  const classItem = await prisma.class.findFirst({
    where: { id: classId, teacherId, isArchived: false },
    include: {
      students: {
        include: {
          student: {
            include: { school: true },
          },
        },
      },
    },
  });

  if (!classItem) {
    return null;
  }

  const roster = classItem.students
    .map((membership) => membership.student)
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));

  const studentIds = roster.map((student) => student.id);

  const [launchAttempts, outcomes] = await Promise.all([
    prisma.playerLaunchAttempt.findMany({
      where: { userId: { in: studentIds } },
      select: {
        userId: true,
        activityKey: true,
        createdAt: true,
        launchAttemptId: true,
        songAssetId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.playerRunOutcome.findMany({
      where: { userId: { in: studentIds } },
      select: {
        userId: true,
        outcome: true,
        completedEvents: true,
        hitAttempts: true,
      },
    }),
  ]);

  const songAssetIds = Array.from(new Set(launchAttempts.map((attempt) => attempt.songAssetId)));
  const songAssets = await prisma.songAsset.findMany({
    where: { id: { in: songAssetIds } },
    select: { id: true, title: true },
  });
  const songTitleById = new Map(songAssets.map((song) => [song.id, song.title]));

  const summaries = roster.map((student): StudentProgressSummary => {
    const attempts = launchAttempts.filter((attempt) => attempt.userId === student.id);
    const studentOutcomes = outcomes.filter((outcome) => outcome.userId === student.id);

    const attemptCountsByActivity = new Map<string, number>();
    for (const attempt of attempts) {
      attemptCountsByActivity.set(
        attempt.activityKey,
        (attemptCountsByActivity.get(attempt.activityKey) ?? 0) + 1,
      );
    }

    const totalCompletedEvents = studentOutcomes.reduce(
      (total, outcome) => total + outcome.completedEvents,
      0,
    );
    const totalHitAttempts = studentOutcomes.reduce(
      (total, outcome) => total + outcome.hitAttempts,
      0,
    );

    const mostRecentAttempt = attempts[0] ?? null;

    return {
      id: student.id,
      name: student.name ?? student.email,
      email: student.email,
      schoolName: student.school?.name ?? null,
      lastLoginAt: student.lastLoginAt,
      totalAttempts: attempts.length,
      attemptsByActivity: Array.from(attemptCountsByActivity.entries()).map(
        ([activityKey, count]) => ({ activityKey, attempts: count }),
      ),
      accuracyPercent:
        totalHitAttempts > 0
          ? Math.round((totalCompletedEvents / totalHitAttempts) * 100)
          : null,
      completedCount: studentOutcomes.filter((outcome) => outcome.outcome === "completed")
        .length,
      failedCount: studentOutcomes.filter((outcome) =>
        outcome.outcome === "failed" || outcome.outcome === "abandoned" || outcome.outcome === "cancelled",
      ).length,
      lastPlayed: mostRecentAttempt
        ? {
            activityKey: mostRecentAttempt.activityKey,
            songTitle: songTitleById.get(mostRecentAttempt.songAssetId) ?? "Unknown song",
            playedAt: mostRecentAttempt.createdAt,
          }
        : null,
    };
  });

  return { id: classItem.id, name: classItem.name, students: summaries };
}
