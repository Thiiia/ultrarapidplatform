type LessonSaveUser = {
  id: string | null | undefined;
  role: string | null | undefined;
};

export function canSaveLessonForAuthor(
  user: LessonSaveUser | null | undefined,
  authorId: string | null | undefined,
) {
  if (!user?.id || !authorId) return false;
  return user.role === "admin" || user.id === authorId;
}
