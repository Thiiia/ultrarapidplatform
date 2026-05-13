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