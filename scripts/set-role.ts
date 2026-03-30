import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const role = process.argv[3] as "student" | "teacher" | "admin";

  if (!email || !role) {
    console.error('Usage: npx tsx scripts/set-role.ts "user@example.com" admin');
    process.exit(1);
  }

  if (!["student", "teacher", "admin"].includes(role)) {
    console.error('Role must be one of: student, teacher, admin');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role },
  });

  console.log("Updated user:");
  console.log({
    id: user.id,
    email: user.email,
    role: user.role,
    auth0Sub: user.auth0Sub,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });