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
};

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
    },
  });

  if (!classItem) {
    return null;
  }

  const students = classItem.students
    .map((membership) => ({
      id: membership.student.id,
      name: membership.student.name ?? membership.student.email,
      email: membership.student.email,
      schoolName: membership.student.school?.name ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: classItem.id,
    name: classItem.name,
    description: classItem.description,
    students,
  };
}