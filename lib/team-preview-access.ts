type TeamPreviewUser = {
  role: "student" | "teacher" | "admin";
  status: "active" | "inactive" | "invited" | "suspended";
};

export function canAccessTeamPreview(user: TeamPreviewUser | null) {
  return (
    user?.status === "active" &&
    (user.role === "teacher" || user.role === "admin")
  );
}
