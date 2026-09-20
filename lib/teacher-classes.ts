import { prisma } from "@/lib/prisma";

export type TeacherClassListItem = {
  id: string;
  name: string;
  description: string | null;
  studentCount: number;
  assignmentCount: number;
};

export type TeacherClassStudentListItem = {
  id: string;
  name: string;
  email: string;
  schoolName: string | null;
  assignments: {
    id: string;
    missionId: string;
    missionTitle: string;
    status: string;
  }[];
};

export type TeacherAssignableMission = {
  id: string;
  title: string;
};

export async function getTeacherAssignableMissions(
  teacherId: string,
): Promise<TeacherAssignableMission[]> {
  const missions = await prisma.mission.findMany({
    where: {
      authorId: teacherId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
    },
  });

  return missions;
}

export async function getTeacherClasses(
  teacherId: string,
): Promise<TeacherClassListItem[]> {
  const classes = await prisma.class.findMany({
    where: {
      isArchived: false,
      teacherId,
    },
    include: {
      students: true,
      assignments: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return classes.map((classItem) => ({
    id: classItem.id,
    name: classItem.name,
    description: classItem.description,
    studentCount: classItem.students.length,
    assignmentCount: classItem.assignments.length,
  }));
}

export async function getTeacherClassStudents({
  teacherId,
  classId,
}: {
  teacherId: string;
  classId: string;
}) {
  const classItem = await prisma.class.findFirst({
    where: {
      id: classId,
      isArchived: false,
      teacherId,
    },
    include: {
      students: {
        include: {
          student: {
            include: {
              school: true,
            },
          },
        },
      },
      assignments: {
        where: {
          status: {
            in: ["assigned", "in_progress"],
          },
        },
        include: {
          mission: true,
        },
      },
    },
  });

  if (!classItem) {
    return null;
  }

  const assignmentsByStudentId = new Map<
    string,
    { id: string; missionId: string; missionTitle: string; status: string }[]
  >();

  for (const assignment of classItem.assignments) {
    if (!assignment.studentId) {
      continue;
    }

    const existing = assignmentsByStudentId.get(assignment.studentId) ?? [];
    existing.push({
      id: assignment.id,
      missionId: assignment.mission.id,
      missionTitle: assignment.mission.title,
      status: assignment.status,
    });
    assignmentsByStudentId.set(assignment.studentId, existing);
  }

  const students = classItem.students
    .map((membership) => ({
      id: membership.student.id,
      name: membership.student.name ?? membership.student.email,
      email: membership.student.email,
      schoolName: membership.student.school?.name ?? null,
      assignments: assignmentsByStudentId.get(membership.student.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: classItem.id,
    name: classItem.name,
    description: classItem.description,
    students,
  };
}