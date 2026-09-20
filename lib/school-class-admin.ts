import { prisma } from "@/lib/prisma";

export async function createSchool(name: string) {
  return prisma.school.create({
    data: {
      name,
    },
  });
}

export async function assignUserToSchool({
  userId,
  schoolId,
}: {
  userId: string;
  schoolId: string;
}) {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      schoolId,
    },
  });
}

export async function makeUserTeacher({
  userId,
  schoolId,
}: {
  userId: string;
  schoolId?: string;
}) {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      role: "teacher",
      schoolId,
    },
  });
}

export async function makeUserStudent({
  userId,
  schoolId,
}: {
  userId: string;
  schoolId?: string;
}) {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      role: "student",
      schoolId,
    },
  });
}

export async function createClassForTeacher({
  name,
  teacherId,
  schoolId,
  description,
  term,
}: {
  name: string;
  teacherId: string;
  schoolId?: string;
  description?: string;
  term?: string;
}) {
  return prisma.class.create({
    data: {
      name,
      teacherId,
      schoolId,
      description,
      term,
    },
  });
}

export async function addStudentToClass({
  studentId,
  classId,
}: {
  studentId: string;
  classId: string;
}) {
  const classRecord = await prisma.class.findUnique({
    where: {
      id: classId,
    },
  });

  if (!classRecord) {
    throw new Error("Class not found.");
  }

  await prisma.user.update({
    where: {
      id: studentId,
    },
    data: {
      role: "student",
      schoolId: classRecord.schoolId,
    },
  });

  return prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId,
        studentId,
      },
    },
    update: {},
    create: {
      classId,
      studentId,
    },
  });
}

export async function removeStudentFromClass({
  studentId,
  classId,
}: {
  studentId: string;
  classId: string;
}) {
  return prisma.classStudent.delete({
    where: {
      classId_studentId: {
        classId,
        studentId,
      },
    },
  });
}

export type AssignMissionToStudentResult =
  | { ok: true; assignment: Awaited<ReturnType<typeof prisma.assignment.create>> }
  | { ok: false; error: string };

/**
 * Creates an individual (student-scoped) Assignment, enforcing that the
 * acting teacher owns the class, the student is enrolled in it, and the
 * teacher authored the mission being assigned.
 */
export async function assignMissionToStudent({
  teacherId,
  classId,
  studentId,
  missionId,
}: {
  teacherId: string;
  classId: string;
  studentId: string;
  missionId: string;
}): Promise<AssignMissionToStudentResult> {
  const classItem = await prisma.class.findFirst({
    where: { id: classId, teacherId, isArchived: false },
    select: { id: true },
  });

  if (!classItem) {
    return { ok: false, error: "Class not found for this teacher." };
  }

  const enrollment = await prisma.classStudent.findUnique({
    where: { classId_studentId: { classId, studentId } },
    select: { studentId: true },
  });

  if (!enrollment) {
    return { ok: false, error: "Student is not enrolled in this class." };
  }

  const mission = await prisma.mission.findFirst({
    where: { id: missionId, authorId: teacherId },
    select: { id: true, title: true },
  });

  if (!mission) {
    return { ok: false, error: "Mission not found for this teacher." };
  }

  const assignment = await prisma.assignment.create({
    data: {
      title: mission.title,
      missionId: mission.id,
      classId,
      studentId,
      createdByUserId: teacherId,
      status: "assigned",
    },
  });

  return { ok: true, assignment };
}