import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.upsert({
    where: {
      id: "demo-school",
    },
    update: {
      name: "Demo School",
    },
    create: {
      id: "demo-school",
      name: "Demo School",
    },
  });

  const student = await prisma.user.upsert({
    where: {
      email: "student@example.com",
    },
    update: {
      role: "student",
      status: "active",
      auth0Sub: "auth0|student-placeholder",
      schoolId: school.id,
    },
    create: {
      email: "student@example.com",
      name: "Student User",
      role: "student",
      status: "active",
      auth0Sub: "auth0|student-placeholder",
      schoolId: school.id,
    },
  });

  const teacher = await prisma.user.upsert({
    where: {
      email: "teacher@example.com",
    },
    update: {
      role: "teacher",
      status: "active",
      auth0Sub: "auth0|teacher-placeholder",
      schoolId: school.id,
    },
    create: {
      email: "teacher@example.com",
      name: "Teacher User",
      role: "teacher",
      status: "active",
      auth0Sub: "auth0|teacher-placeholder",
      schoolId: school.id,
    },
  });

  const classRecord = await prisma.class.upsert({
    where: {
      id: "demo-class",
    },
    update: {
      name: "Demo Music Class",
      description: "A sample class for testing student and teacher dashboards.",
      term: "Demo Term",
      schoolId: school.id,
      teacherId: teacher.id,
      isArchived: false,
    },
    create: {
      id: "demo-class",
      name: "Demo Music Class",
      description: "A sample class for testing student and teacher dashboards.",
      term: "Demo Term",
      schoolId: school.id,
      teacherId: teacher.id,
      isArchived: false,
    },
  });

  await prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId: classRecord.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      classId: classRecord.id,
      studentId: student.id,
    },
  });

  const mission = await prisma.mission.upsert({
    where: {
      id: "demo-rhythm-basics",
    },
    update: {
      title: "Rhythm Basics",
      description: "Practice steady beat, timing, and rhythm recognition.",
      published: true,
      contentJson: {
        type: "lesson",
        difficulty: "easy",
        estimatedMinutes: 15,
        activities: [
          {
            type: "practice",
            title: "Clap the Beat",
          },
          {
            type: "checkpoint",
            title: "Timing Check",
          },
        ],
      },
      authorId: teacher.id,
    },
    create: {
      id: "demo-rhythm-basics",
      title: "Rhythm Basics",
      description: "Practice steady beat, timing, and rhythm recognition.",
      published: true,
      contentJson: {
        type: "lesson",
        difficulty: "easy",
        estimatedMinutes: 15,
        activities: [
          {
            type: "practice",
            title: "Clap the Beat",
          },
          {
            type: "checkpoint",
            title: "Timing Check",
          },
        ],
      },
      authorId: teacher.id,
    },
  });

  await prisma.assignment.upsert({
    where: {
      id: "demo-rhythm-basics-assignment",
    },
    update: {
      title: "Lesson 1: Rhythm Basics",
      description: "Complete the Rhythm Basics lesson and submit your checkpoint.",
      missionId: mission.id,
      classId: classRecord.id,
      studentId: null,
      createdByUserId: teacher.id,
      status: "assigned",
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: "demo-rhythm-basics-assignment",
      title: "Lesson 1: Rhythm Basics",
      description: "Complete the Rhythm Basics lesson and submit your checkpoint.",
      missionId: mission.id,
      classId: classRecord.id,
      studentId: null,
      createdByUserId: teacher.id,
      status: "assigned",
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.progress.upsert({
    where: {
      userId_missionId: {
        userId: student.id,
        missionId: mission.id,
      },
    },
    update: {
      status: "in_progress",
      score: 25,
    },
    create: {
      userId: student.id,
      missionId: mission.id,
      status: "in_progress",
      score: 25,
    },
  });

  console.log("Seed complete:");
  console.log(`- School: ${school.name}`);
  console.log(`- Teacher: ${teacher.email}`);
  console.log(`- Student: ${student.email}`);
  console.log(`- Class: ${classRecord.name}`);
  console.log(`- Mission: ${mission.title}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });