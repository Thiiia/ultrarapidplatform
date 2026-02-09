import { prisma } from "../lib/prisma";

async function main() {
  console.log("🌱 Seeding database...");

  // Clear in dependency order
  await prisma.progress.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.user.deleteMany();

  const teacher = await prisma.user.create({
    data: {
      name: "Teacher One",
      role: "teacher",
      email: "teacher@example.com",
    },
  });

  const student = await prisma.user.create({
    data: {
      name: "Student One",
      role: "student",
      email: "student@example.com",
    },
  });

  const m1 = await prisma.mission.create({
    data: {
      title: "Mission 1: Intro",
      description: "A simple starter mission.",
      published: true,
      authorId: teacher.id,
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "dialogue", text: "Welcome!" }],
      },
    },
  });

  await prisma.mission.create({
    data: {
      title: "Mission 2: Practice",
      description: "A second mission to test progress tracking.",
      published: true,
      authorId: teacher.id,
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "objective", text: "Try something new." }],
      },
    },
  });

  await prisma.mission.create({
    data: {
      title: "Mission 3: Draft (Teacher only)",
      description: "Unpublished draft mission.",
      published: false,
      authorId: teacher.id,
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "objective", text: "Draft content." }],
      },
    },
  });

  await prisma.progress.create({
    data: {
      userId: student.id,
      missionId: m1.id,
      status: "in_progress",
      score: 10,
    },
  });

  console.log("✅ Seed complete");
  console.log("Teacher:", teacher.email);
  console.log("Student:", student.email);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
