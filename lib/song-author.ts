export type LaunchAuthor = {
  id: string;
  name: string | null;
};

export async function resolveRequestedAuthor({
  authorId,
  authorName,
  findById,
  findByName,
  getDefault,
}: {
  authorId?: string | null;
  authorName?: string | null;
  findById: (id: string) => Promise<LaunchAuthor | null>;
  findByName: (name: string) => Promise<LaunchAuthor | null>;
  getDefault: () => Promise<LaunchAuthor | null>;
}): Promise<LaunchAuthor | null> {
  const normalizedId = authorId?.trim() || null;
  const normalizedName = authorName?.trim() || null;

  const byId = normalizedId ? await findById(normalizedId) : null;
  if (normalizedId && !byId) {
    throw new Error(`Author not found: ${normalizedId}`);
  }

  const byName = normalizedName ? await findByName(normalizedName) : null;
  if (normalizedName && !byName) {
    throw new Error(`Author not found: ${normalizedName}`);
  }

  if (byId && byName && byId.id !== byName.id) {
    throw new Error("authorId and authorName do not identify the same author");
  }

  return byId ?? byName ?? (normalizedId || normalizedName ? null : getDefault());
}
