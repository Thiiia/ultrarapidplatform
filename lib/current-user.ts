import { getAuth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function getCurrentAppUser() {
  const session = await getAuth0().getSession();

  if (!session?.user) {
    return null;
  }

  const sub = session.user.sub;
  const email = session.user.email;
  const name = session.user.name;

  if (!sub || !email) {
    return null;
  }

  const user = await prisma.user.upsert({
    where: { auth0Sub: sub },
    update: {
      email,
      name: name ?? null,
    },
    create: {
      auth0Sub: sub,
      email,
      name: name ?? null,
      role: "student",
    },
  });

  return user;
}