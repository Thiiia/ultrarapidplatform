import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MISSION_CONTENT,
  type MissionContent,
} from "@/lib/contracts/missionContent";

export type ActivityKey =
  | "number-bonds"
  | "equations"
  | "missing-numbers"
  | "early-algebra";

export type TeacherActivityMission = {
  id: string;
  title: string;
  description: string | null;
};

/**
 * Missions aren't tagged with an activity via a dedicated column; the activity
 * key is stored in contentJson.meta.tags so no schema migration is required.
 */
function getMissionActivityKey(contentJson: Prisma.JsonValue): string | null {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) {
    return null;
  }

  const meta = (contentJson as Record<string, unknown>).meta;
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const tags = (meta as Record<string, unknown>).tags;
  if (!Array.isArray(tags)) {
    return null;
  }

  const activityTag = tags.find(
    (tag) => typeof tag === "string" && tag.startsWith("activity:"),
  );

  return typeof activityTag === "string" ? activityTag.slice("activity:".length) : null;
}

export async function getTeacherMissionsByActivity({
  teacherId,
  activityKey,
}: {
  teacherId: string;
  activityKey: ActivityKey;
}): Promise<TeacherActivityMission[]> {
  const missions = await prisma.mission.findMany({
    where: { authorId: teacherId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, description: true, contentJson: true },
  });

  return missions
    .filter((mission) => getMissionActivityKey(mission.contentJson) === activityKey)
    .map((mission) => ({
      id: mission.id,
      title: mission.title,
      description: mission.description,
    }));
}

export async function createTeacherActivityMission({
  teacherId,
  activityKey,
  title,
  description,
}: {
  teacherId: string;
  activityKey: ActivityKey;
  title: string;
  description?: string;
}): Promise<TeacherActivityMission> {
  const content: MissionContent = {
    ...DEFAULT_MISSION_CONTENT,
    meta: {
      ...DEFAULT_MISSION_CONTENT.meta,
      tags: [`activity:${activityKey}`],
    },
  };

  const mission = await prisma.mission.create({
    data: {
      title,
      description: description ?? "",
      published: true,
      contentJson: content as unknown as Prisma.InputJsonValue,
      authorId: teacherId,
    },
    select: { id: true, title: true, description: true },
  });

  return mission;
}
