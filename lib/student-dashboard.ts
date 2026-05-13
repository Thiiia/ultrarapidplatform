import { prisma } from "@/lib/prisma";

export type StudentDashboardData = NonNullable<
  Awaited<ReturnType<typeof getStudentDashboardData>>
>;

export async function getStudentDashboardData(userId: string) {
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

  const assignments = await prisma.assignment.findMany({
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
  });

  const progressRecords = await prisma.progress.findMany({
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
  });

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
    href: `/student/lessons?assignmentId=${assignment.id}`,
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
      href: `/student/lessons?missionId=${progress.mission.id}`,
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