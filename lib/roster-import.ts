import type { Prisma, RosterImportMode, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseRosterCsv,
  RosterValidationError,
  type RosterRow,
  type RosterValidationIssue,
} from "@/lib/roster-import-parser";

type RosterClient = Prisma.TransactionClient | typeof prisma;

type RosterTeacher = {
  externalId: string | null;
  email: string;
  name: string;
};

type RosterStudent = {
  externalId: string;
  email: string;
  name: string;
};

type RosterClass = {
  externalId: string;
  name: string;
  teacherKey: string;
  term: string | null;
};

export type RosterImportSummary = {
  rows: number;
  teachersCreated: number;
  teachersUpdated: number;
  studentsCreated: number;
  studentsUpdated: number;
  classesCreated: number;
  classesUpdated: number;
  enrollmentsAdded: number;
  enrollmentsRemoved: number;
  studentsDeactivated: number;
};

function summariesMatch(
  actual: RosterImportSummary,
  expected: Record<string, unknown>,
) {
  return (Object.keys(actual) as (keyof RosterImportSummary)[]).every(
    (key) => actual[key] === expected[key],
  );
}

type RosterContext = {
  teachers: RosterTeacher[];
  students: RosterStudent[];
  classes: RosterClass[];
  existingTeachers: Map<string, User>;
  existingStudents: Map<string, User>;
  existingClasses: Map<string, { id: string; name: string; externalId: string | null; teacherId: string; term: string | null }>;
  summary: RosterImportSummary;
};

function uniqueRosterEntities(rows: RosterRow[]) {
  const teachers = new Map<string, RosterTeacher>();
  const students = new Map<string, RosterStudent>();
  const classes = new Map<string, RosterClass>();

  for (const row of rows) {
    const teacherKey = row.teacher_external_id || row.teacher_email;
    teachers.set(teacherKey, {
      externalId: row.teacher_external_id || null,
      email: row.teacher_email,
      name: row.teacher_name,
    });
    students.set(row.student_external_id, {
      externalId: row.student_external_id,
      email: row.student_email,
      name: row.student_name,
    });
    classes.set(row.class_external_id, {
      externalId: row.class_external_id,
      name: row.class_name,
      teacherKey,
      term: row.term || null,
    });
  }

  return {
    teachers: [...teachers.values()],
    students: [...students.values()],
    classes: [...classes.values()],
  };
}

function resolveUser(
  usersByEmail: Map<string, User>,
  usersByExternalId: Map<string, User>,
  email: string,
  externalId: string | null,
  schoolId: string,
  expectedRole: "student" | "teacher",
  issues: RosterValidationIssue[],
) {
  const byEmail = usersByEmail.get(email);
  const byExternalId = externalId ? usersByExternalId.get(externalId) : undefined;

  if (byEmail && byExternalId && byEmail.id !== byExternalId.id) {
    issues.push({ row: 1, message: `${email} and external ID ${externalId} identify different users.` });
    return null;
  }

  const user = byExternalId ?? byEmail;
  if (!user) {
    return null;
  }

  if (user.schoolId && user.schoolId !== schoolId) {
    issues.push({ row: 1, message: `${email} already belongs to another school.` });
  }

  if (user.role === "admin" || user.role !== expectedRole) {
    issues.push({ row: 1, message: `${email} already has the ${user.role} role.` });
  }

  return user;
}

function userNeedsUpdate(
  existing: User,
  expected: { email: string; externalId: string | null; name: string },
  schoolId: string,
) {
  const expectedStatus = existing.auth0Sub ? "active" : "invited";
  return (
    existing.email.toLowerCase() !== expected.email ||
    existing.normalizedEmail !== expected.email ||
    existing.externalId !== expected.externalId ||
    existing.name !== expected.name ||
    existing.schoolId !== schoolId ||
    existing.status !== expectedStatus
  );
}

async function buildRosterContext(
  client: RosterClient,
  schoolId: string,
  rows: RosterRow[],
  mode: RosterImportMode,
): Promise<RosterContext> {
  const school = await client.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) {
    throw new RosterValidationError([{ row: 1, message: "School not found." }]);
  }

  const entities = uniqueRosterEntities(rows);
  const emails = [...new Set([...entities.students, ...entities.teachers].map((item) => item.email))];
  const externalIds = [
    ...entities.students.map((item) => item.externalId),
    ...entities.teachers.flatMap((item) => (item.externalId ? [item.externalId] : [])),
  ];
  const users = await client.user.findMany({
    where: {
      OR: [
        { normalizedEmail: { in: emails } },
        { email: { in: emails, mode: "insensitive" } },
        { schoolId, externalId: { in: externalIds } },
      ],
    },
  });
  const usersByEmail = new Map(users.map((user) => [(user.normalizedEmail ?? user.email.toLowerCase()), user]));
  const usersByExternalId = new Map(
    users.filter((user) => user.schoolId === schoolId && user.externalId).map((user) => [user.externalId!, user]),
  );
  const issues: RosterValidationIssue[] = [];
  const existingTeachers = new Map<string, User>();
  const existingStudents = new Map<string, User>();

  for (const teacher of entities.teachers) {
    const key = teacher.externalId || teacher.email;
    const existing = resolveUser(
      usersByEmail,
      usersByExternalId,
      teacher.email,
      teacher.externalId,
      schoolId,
      "teacher",
      issues,
    );
    if (existing) existingTeachers.set(key, existing);
  }

  for (const student of entities.students) {
    const existing = resolveUser(
      usersByEmail,
      usersByExternalId,
      student.email,
      student.externalId,
      schoolId,
      "student",
      issues,
    );
    if (existing) existingStudents.set(student.externalId, existing);
  }

  const databaseClasses = await client.class.findMany({
    where: {
      schoolId,
      OR: [
        { externalId: { in: entities.classes.map((item) => item.externalId) } },
        { name: { in: entities.classes.map((item) => item.name) } },
      ],
    },
    select: { id: true, name: true, externalId: true, teacherId: true, term: true },
  });
  const classesByExternalId = new Map(
    databaseClasses.filter((item) => item.externalId).map((item) => [item.externalId!, item]),
  );
  const classesByName = new Map(databaseClasses.map((item) => [item.name, item]));
  const existingClasses = new Map<string, (typeof databaseClasses)[number]>();

  for (const classItem of entities.classes) {
    const byExternalId = classesByExternalId.get(classItem.externalId);
    const byName = classesByName.get(classItem.name);
    if (byExternalId && byName && byExternalId.id !== byName.id) {
      issues.push({
        row: 1,
        message: `Class ${classItem.externalId} and name ${classItem.name} identify different classes.`,
      });
      continue;
    }
    const existing = byExternalId ?? byName;
    if (existing) existingClasses.set(classItem.externalId, existing);
  }

  if (issues.length) {
    throw new RosterValidationError(issues);
  }

  const existingClassIds = [...existingClasses.values()].map((item) => item.id);
  const existingStudentIds = [...existingStudents.values()].map((item) => item.id);
  const memberships = existingClassIds.length && existingStudentIds.length
    ? await client.classStudent.findMany({
        where: { classId: { in: existingClassIds }, studentId: { in: existingStudentIds } },
      })
    : [];
  const membershipKeys = new Set(memberships.map((item) => `${item.classId}\0${item.studentId}`));
  let enrollmentsAdded = 0;

  for (const row of rows) {
    const classItem = existingClasses.get(row.class_external_id);
    const student = existingStudents.get(row.student_external_id);
    if (!classItem || !student || !membershipKeys.has(`${classItem.id}\0${student.id}`)) {
      enrollmentsAdded += 1;
    }
  }

  let enrollmentsRemoved = 0;
  let studentsDeactivated = 0;
  if (mode === "reconcile") {
    const rosterClassIds = [...existingClasses.values()].map((item) => item.id);
    if (rosterClassIds.length) {
      const allMemberships = await client.classStudent.findMany({
        where: { classId: { in: rosterClassIds } },
      });
      const expected = new Set(
        rows.flatMap((row) => {
          const classItem = existingClasses.get(row.class_external_id);
          const student = existingStudents.get(row.student_external_id);
          return classItem && student ? [`${classItem.id}\0${student.id}`] : [];
        }),
      );
      enrollmentsRemoved = allMemberships.filter(
        (item) => !expected.has(`${item.classId}\0${item.studentId}`),
      ).length;
    }

    studentsDeactivated = await client.user.count({
      where: {
        schoolId,
        role: "student",
        status: { not: "inactive" },
        externalId: { not: null, notIn: entities.students.map((item) => item.externalId) },
      },
    });
  }

  const teachersUpdated = entities.teachers.filter((teacher) => {
    const existing = existingTeachers.get(teacher.externalId || teacher.email);
    return existing ? userNeedsUpdate(existing, teacher, schoolId) : false;
  }).length;
  const studentsUpdated = entities.students.filter((student) => {
    const existing = existingStudents.get(student.externalId);
    return existing ? userNeedsUpdate(existing, student, schoolId) : false;
  }).length;
  const classesUpdated = entities.classes.filter((classItem) => {
    const existing = existingClasses.get(classItem.externalId);
    const teacherId = existingTeachers.get(classItem.teacherKey)?.id;
    return existing
      ? existing.name !== classItem.name ||
          existing.externalId !== classItem.externalId ||
          existing.term !== classItem.term ||
          existing.teacherId !== teacherId
      : false;
  }).length;

  return {
    ...entities,
    existingTeachers,
    existingStudents,
    existingClasses,
    summary: {
      rows: rows.length,
      teachersCreated: entities.teachers.length - existingTeachers.size,
      teachersUpdated,
      studentsCreated: entities.students.length - existingStudents.size,
      studentsUpdated,
      classesCreated: entities.classes.length - existingClasses.size,
      classesUpdated,
      enrollmentsAdded,
      enrollmentsRemoved,
      studentsDeactivated,
    },
  };
}

export async function previewRosterImport({
  schoolId,
  csvText,
  mode,
}: {
  schoolId: string;
  csvText: string;
  mode: RosterImportMode;
}) {
  const rows = parseRosterCsv(csvText);
  const context = await buildRosterContext(prisma, schoolId, rows, mode);
  return context.summary;
}

export async function applyRosterImport({
  schoolId,
  uploadedById,
  filename,
  csvText,
  mode,
  expectedSummary,
}: {
  schoolId: string;
  uploadedById: string;
  filename: string;
  csvText: string;
  mode: RosterImportMode;
  expectedSummary: Record<string, unknown>;
}) {
  const rows = parseRosterCsv(csvText);
  const audit = await prisma.rosterImport.create({
    data: { schoolId, uploadedById, filename, mode },
  });

  try {
    const summary = await prisma.$transaction(async (transaction) => {
      const context = await buildRosterContext(transaction, schoolId, rows, mode);
      if (!summariesMatch(context.summary, expectedSummary)) {
        throw new RosterValidationError([
          { row: 1, message: "The roster data changed after preview. Preview it again before applying." },
        ]);
      }
      const teacherIds = new Map<string, string>();
      const studentIds = new Map<string, string>();
      const classIds = new Map<string, string>();

      for (const teacher of context.teachers) {
        const key = teacher.externalId || teacher.email;
        const existing = context.existingTeachers.get(key);
        const data = {
          email: teacher.email,
          normalizedEmail: teacher.email,
          externalId: teacher.externalId,
          name: teacher.name,
          role: "teacher" as const,
          schoolId,
          status: existing?.auth0Sub ? ("active" as const) : ("invited" as const),
        };
        const user = existing
          ? await transaction.user.update({ where: { id: existing.id }, data })
          : await transaction.user.create({ data });
        teacherIds.set(key, user.id);
      }

      for (const student of context.students) {
        const existing = context.existingStudents.get(student.externalId);
        const data = {
          email: student.email,
          normalizedEmail: student.email,
          externalId: student.externalId,
          name: student.name,
          role: "student" as const,
          schoolId,
          status: existing?.auth0Sub ? ("active" as const) : ("invited" as const),
        };
        const user = existing
          ? await transaction.user.update({ where: { id: existing.id }, data })
          : await transaction.user.create({ data });
        studentIds.set(student.externalId, user.id);
      }

      for (const classItem of context.classes) {
        const teacherId = teacherIds.get(classItem.teacherKey)!;
        const existing = context.existingClasses.get(classItem.externalId);
        const data = {
          name: classItem.name,
          externalId: classItem.externalId,
          term: classItem.term,
          teacherId,
          schoolId,
          isArchived: false,
        };
        const savedClass = existing
          ? await transaction.class.update({ where: { id: existing.id }, data })
          : await transaction.class.create({ data });
        classIds.set(classItem.externalId, savedClass.id);
        await transaction.teacherClass.upsert({
          where: { teacherId_classId: { teacherId, classId: savedClass.id } },
          update: {},
          create: { teacherId, classId: savedClass.id },
        });
        if (mode === "reconcile") {
          await transaction.teacherClass.deleteMany({
            where: { classId: savedClass.id, teacherId: { not: teacherId } },
          });
        }
      }

      for (const row of rows) {
        await transaction.classStudent.upsert({
          where: {
            classId_studentId: {
              classId: classIds.get(row.class_external_id)!,
              studentId: studentIds.get(row.student_external_id)!,
            },
          },
          update: {},
          create: {
            classId: classIds.get(row.class_external_id)!,
            studentId: studentIds.get(row.student_external_id)!,
          },
        });
      }

      if (mode === "reconcile") {
        for (const classItem of context.classes) {
          const classId = classIds.get(classItem.externalId)!;
          const expectedStudentIds = rows
            .filter((row) => row.class_external_id === classItem.externalId)
            .map((row) => studentIds.get(row.student_external_id)!);
          await transaction.classStudent.deleteMany({
            where: { classId, studentId: { notIn: expectedStudentIds } },
          });
        }

        await transaction.user.updateMany({
          where: {
            schoolId,
            role: "student",
            externalId: { not: null, notIn: context.students.map((item) => item.externalId) },
          },
          data: { status: "inactive" },
        });
      }

      await transaction.rosterImport.update({
        where: { id: audit.id },
        data: {
          status: "completed",
          summaryJson: context.summary,
          completedAt: new Date(),
        },
      });
      return context.summary;
    });

    return { importId: audit.id, summary };
  } catch (error) {
    const errorJson = error instanceof RosterValidationError
      ? error.issues
      : [{ row: 1, message: error instanceof Error ? error.message : "Import failed." }];
    await prisma.rosterImport.update({
      where: { id: audit.id },
      data: { status: "failed", errorJson, completedAt: new Date() },
    });
    throw error;
  }
}