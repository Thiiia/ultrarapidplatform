import { prisma } from "@/lib/prisma";
import {
  getStudentAssignmentHref,
  getStudentMissionHref,
  type StudentDashboardPath,
} from "@/lib/student-lesson-flow";

export type StudentLessonDetail = {
  kind: "assignment" | "progress";
  assignmentId: string | null;
  missionId: string;
  title: string;
  description: string | null;
  status: string;
  dueAt: string | null;
  className: string | null;
  teacherName: string | null;
  missionPublished: boolean;
  missionContent: unknown;
};

export type StudentDashboardData = NonNullable<
  Awaited<ReturnType<typeof getStudentDashboardData>>
>;

export async function getStudentDashboardData(
  userId: string,
  options: { navBasePath?: StudentDashboardPath } = {},
) {
  const navBasePath = options.navBasePath ?? "/student";
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      school: true,
      classMemberships: {
        include: {
          class: {
            include: {
              teacher: true,
            },
          },
        },
      },
    },
  });

  if (!user || user.role !== "student") {
    return null;
  }

  const [assignments, progressRecords] = await Promise.all([
    prisma.assignment.findMany({
    where: {
      status: {
        in: ["assigned", "in_progress"],
      },
      OR: [
        {
          studentId: user.id,
        },
        {
          class: {
            students: {
              some: {
                studentId: user.id,
              },
            },
          },
        },
      ],
    },
    include: {
      mission: true,
      class: {
        include: {
          teacher: true,
        },
      },
      createdBy: true,
    },
    orderBy: [
      {
        dueAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
    take: 6,
    }),
    prisma.progress.findMany({
    where: {
      userId: user.id,
      status: {
        in: ["not_started", "in_progress"],
      },
    },
    include: {
      mission: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 6,
    }),
  ]);

  const classes = user.classMemberships.map((membership) => membership.class);

  const teachersById = new Map<
    string,
    {
      id: string;
      name: string | null;
      email: string;
    }
  >();

  for (const classItem of classes) {
    teachersById.set(classItem.teacher.id, {
      id: classItem.teacher.id,
      name: classItem.teacher.name,
      email: classItem.teacher.email,
    });
  }

  const assignmentLessons = assignments.map((assignment) => ({
    assignmentId: assignment.id,
    missionId: assignment.mission.id,
    title: assignment.title || assignment.mission.title,
    description: assignment.description ?? assignment.mission.description,
    status: assignment.status,
    dueAt: assignment.dueAt,
    className: assignment.class?.name ?? null,
    teacherName:
      assignment.class?.teacher.name ??
      assignment.createdBy.name ??
      assignment.createdBy.email,
    href: getStudentAssignmentHref(navBasePath, assignment.id),
  }));

  const progressLessons = progressRecords
    .filter((progress) => {
      return !assignmentLessons.some(
        (lesson) => lesson.missionId === progress.missionId,
      );
    })
    .map((progress) => ({
      assignmentId: null,
      missionId: progress.mission.id,
      title: progress.mission.title,
      description: progress.mission.description,
      status: progress.status,
      dueAt: null,
      className: null,
      teacherName: null,
      href: getStudentMissionHref(navBasePath, progress.mission.id),
    }));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    school: user.school
      ? {
          id: user.school.id,
          name: user.school.name,
        }
      : null,
    classes: classes.map((classItem) => ({
      id: classItem.id,
      name: classItem.name,
      teacher: {
        id: classItem.teacher.id,
        name: classItem.teacher.name,
        email: classItem.teacher.email,
      },
    })),
    teachers: Array.from(teachersById.values()),
    currentLessons: [...assignmentLessons, ...progressLessons].slice(0, 6),
  };
}

/**
 * Resolve a lesson only when the current student owns its progress record or
 * is the named student / a member of the assigned class. IDs in a query string
 * are navigation hints, never authorization.
 */
export async function getStudentLessonDetail(
  userId: string,
  identity: { assignmentId?: string | null; missionId?: string | null },
): Promise<StudentLessonDetail | null> {
  const assignmentId = identity.assignmentId?.trim() || null;
  const missionId = identity.missionId?.trim() || null;

  if (!userId || Boolean(assignmentId) === Boolean(missionId)) {
    return null;
  }

  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (student?.role !== "student") return null;

  if (assignmentId) {
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        status: { in: ["assigned", "in_progress"] },
        OR: [
          { studentId: userId },
          {
            class: {
              students: { some: { studentId: userId } },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueAt: true,
        mission: {
          select: {
            id: true,
            title: true,
            description: true,
            published: true,
            contentJson: true,
          },
        },
        class: {
          select: {
            name: true,
            teacher: { select: { name: true, email: true } },
          },
        },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!assignment) return null;

    return {
      kind: "assignment",
      assignmentId: assignment.id,
      missionId: assignment.mission.id,
      title: assignment.title || assignment.mission.title,
      description: assignment.description ?? assignment.mission.description,
      status: assignment.status,
      dueAt: assignment.dueAt?.toISOString() ?? null,
      className: assignment.class?.name ?? null,
      teacherName:
        assignment.class?.teacher.name ??
        assignment.createdBy.name ??
        assignment.createdBy.email,
      missionPublished: assignment.mission.published,
      missionContent: assignment.mission.contentJson,
    };
  }

  if (!missionId) return null;

  const progress = await prisma.progress.findUnique({
    where: {
      userId_missionId: {
        userId,
        missionId,
      },
    },
    select: {
      status: true,
      mission: {
        select: {
          id: true,
          title: true,
          description: true,
          published: true,
          contentJson: true,
        },
      },
    },
  });

  if (!progress) return null;

  return {
    kind: "progress",
    assignmentId: null,
    missionId: progress.mission.id,
    title: progress.mission.title,
    description: progress.mission.description,
    status: progress.status,
    dueAt: null,
    className: null,
    teacherName: null,
    missionPublished: progress.mission.published,
    missionContent: progress.mission.contentJson,
  };
}
