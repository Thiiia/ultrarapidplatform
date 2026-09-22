import { getCurrentAppUser } from "@/lib/current-user";

export async function requireAdmin() {
  const user = await getCurrentAppUser();

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}