/** Keep "Last on site" useful without writing the user row on every route. */
export const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

export function shouldRefreshCurrentUser(
  user: { email: string; normalizedEmail: string; lastLoginAt: Date | null },
  normalizedEmail: string,
  now: Date,
) {
  return user.email !== normalizedEmail ||
    user.normalizedEmail !== normalizedEmail ||
    user.lastLoginAt == null ||
    now.getTime() - user.lastLoginAt.getTime() >= LAST_SEEN_WRITE_INTERVAL_MS;
}
