import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "student@example.com" },
    update: {
      role: "student",
      auth0Sub: "auth0|student-placeholder",
    },
    create: {
      email: "student@example.com",
      name: "Student User",
      role: "student",
      auth0Sub: "auth0|student-placeholder",
    },
  });

  await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {
      role: "teacher",
      auth0Sub: "auth0|teacher-placeholder",
    },
    create: {
      email: "teacher@example.com",
      name: "Teacher User",
      role: "teacher",
      auth0Sub: "auth0|teacher-placeholder",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });