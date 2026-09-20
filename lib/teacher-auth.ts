import { getCurrentAppUser } from "@/lib/current-user";

/**
 * Resolves the acting teacher for write endpoints shared by the real teacher
 * app and the public /demo/teacher sandbox: an authenticated teacher session,
 * or (demo only) a demoTeacherId matching the fixed DEMO_TEACHER_USER_ID env
 * var, mirroring the rest of the /demo route tree's trust model.
 */
export async function resolveActingTeacherId(
  demoTeacherId: string | null,
): Promise<string | null> {
  const sessionUser = await getCurrentAppUser();
  if (sessionUser && sessionUser.role === "teacher") {
    return sessionUser.id;
  }

  if (
    demoTeacherId &&
    process.env.DEMO_TEACHER_USER_ID &&
    demoTeacherId === process.env.DEMO_TEACHER_USER_ID
  ) {
    return demoTeacherId;
  }

  return null;
}
