import { getAuth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function getCurrentAppUser() {
  const session = await getAuth0().getSession();

  if (!session?.user) {
    return null;
  }

  const auth0Sub = session.user.sub;
  const email = session.user.email;
  const auth0Name = session.user.name;

  if (!auth0Sub || !email) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      auth0Sub,
    },
  });

  if (!existingUser) {
    const invitedUser = await prisma.user.findUnique({
      where: { normalizedEmail },
    });

    if (invitedUser) {
      if (invitedUser.auth0Sub || invitedUser.status !== "invited") {
        throw new Error("This email is already linked to another account.");
      }

      if (session.user.email_verified !== true) {
        throw new Error("Verify your email before claiming an invited account.");
      }

      return prisma.user.update({
        where: { id: invitedUser.id },
        data: {
          auth0Sub,
          email: normalizedEmail,
          name: invitedUser.name ?? auth0Name ?? null,
          status: "active",
          lastLoginAt: new Date(),
        },
      });
    }

    return prisma.user.create({
      data: {
        auth0Sub,
        email: normalizedEmail,
        normalizedEmail,
        name: auth0Name ?? null,
        role: "student",
        status: "active",
        lastLoginAt: new Date(),
      },
    });
  }

  return prisma.user.update({
    where: {
      auth0Sub,
    },
    data: {
      email: normalizedEmail,
      normalizedEmail,
      name: existingUser.name ?? auth0Name ?? null,
      lastLoginAt: new Date(),
    },
  });
}

export async function requireCurrentAppUser() {
  const user = await getCurrentAppUser();

  if (!user) {
    throw new Error("User is not authenticated.");
  }

  return user;
}