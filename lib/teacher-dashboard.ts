import { prisma } from "@/lib/prisma";

export type TeacherDashboardData = NonNullable<
  Awaited<ReturnType<typeof getTeacherDashboardData>>
>;

export async function getTeacherDashboardData(userId: string) {
  const teacher = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      school: true,
      classesTaught: {
        include: {
          students: {
            include: {
              student: true,
            },
          },
          assignments: {
            include: {
              mission: true,
              student: true,
            },
            orderBy: [
              {
                dueAt: "asc",
              },
              {
                createdAt: "desc",
              },
            ],
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
      authoredMissions: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 8,
      },
    },
  });

  if (!teacher || teacher.role !== "teacher") {
    return null;
  }

  const studentsById = new Map<
    string,
    {
      id: string;
      name: string | null;
      email: string;
      classIds: string[];
      classNames: string[];
    }
  >();

  for (const classItem of teacher.classesTaught) {
    for (const membership of classItem.students) {
      const existingStudent = studentsById.get(membership.student.id);

      if (existingStudent) {
        existingStudent.classIds.push(classItem.id);
        existingStudent.classNames.push(classItem.name);
      } else {
        studentsById.set(membership.student.id, {
          id: membership.student.id,
          name: membership.student.name,
          email: membership.student.email,
          classIds: [classItem.id],
          classNames: [classItem.name],
        });
      }
    }
  }

  const students = Array.from(studentsById.values());

  const activeAssignmentCount = teacher.classesTaught.reduce((total, classItem) => {
    return (
      total +
      classItem.assignments.filter((assignment) => {
        return assignment.status === "assigned" || assignment.status === "in_progress";
      }).length
    );
  }, 0);

  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    school: teacher.school
      ? {
          id: teacher.school.id,
          name: teacher.school.name,
        }
      : null,
    classes: teacher.classesTaught.map((classItem) => ({
      id: classItem.id,
      name: classItem.name,
      description: classItem.description,
      term: classItem.term,
      isArchived: classItem.isArchived,
      studentCount: classItem.students.length,
      assignments: classItem.assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        status: assignment.status,
        dueAt: assignment.dueAt,
        missionId: assignment.mission.id,
        missionTitle: assignment.mission.title,
        studentId: assignment.studentId,
        studentName: assignment.student?.name ?? assignment.student?.email ?? null,
      })),
    })),
    students,
    authoredMissions: teacher.authoredMissions.map((mission) => ({
      id: mission.id,
      title: mission.title,
      description: mission.description,
      published: mission.published,
      updatedAt: mission.updatedAt,
    })),
    totals: {
      classCount: teacher.classesTaught.length,
      studentCount: students.length,
      activeAssignmentCount,
      missionCount: teacher.authoredMissions.length,
    },
  };
}