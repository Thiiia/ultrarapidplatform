import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/lib/schemas";

type LessonSaveUser = {
  id: string | null | undefined;
  role: string | null | undefined;
};

const userRoles = new Set<UserRole>(["student", "teacher", "admin"]);

function hasRole(
  user: LessonSaveUser | null | undefined,
): user is LessonSaveUser & { id: string; role: UserRole } {
  return Boolean(user?.id && user.role && userRoles.has(user.role as UserRole));
}

export function canSaveLessonForAuthor(
  user: LessonSaveUser | null | undefined,
  authorId: string | null | undefined,
) {
  if (!hasRole(user) || !authorId || !hasPermission(user.role, "edit_content")) return false;
  return user.role === "admin" || user.id === authorId;
}

export function canPublishLessonForAuthor(
  user: LessonSaveUser | null | undefined,
  authorId: string | null | undefined,
) {
  if (!hasRole(user) || !authorId || !hasPermission(user.role, "publish_content")) return false;
  return user.role === "admin" || (user.role === "teacher" && user.id === authorId);
}

export function canPreviewOwnLessonDraft(
  user: LessonSaveUser | null | undefined,
  authorId: string | null | undefined,
  revision: string | null | undefined,
) {
  return Boolean(
    hasRole(user) &&
      user.role === "student" &&
      authorId &&
      user.id === authorId &&
      revision?.trim(),
  );
}

export function canReadEditorAuthor(
  user: LessonSaveUser | null | undefined,
  targetAuthorId: string | null | undefined,
  demoAuthorId: string | null | undefined,
) {
  if (!targetAuthorId) return false;
  if (!hasRole(user)) return Boolean(demoAuthorId && targetAuthorId === demoAuthorId);
  return user.role === "admin" || user.id === targetAuthorId || targetAuthorId === demoAuthorId;
}
