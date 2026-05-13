// Defines what permissions each user role has and provides helper functions to check permissions and control access to routes and UI elements
import type { UserRole } from "@/lib/schemas";

export type Permission =
  | "view_teacher_dashboard"
  | "view_student_dashboard"
  | "view_editor_dashboard"
  | "view_launcher"
  | "view_student_metrics"
  | "view_own_scores"
  | "view_assignments"
  | "manage_assignments"
  | "edit_content"
  | "publish_content"
  | "manage_users"
  | "manage_classes"
  | "view_reports"
  | "preview_game"
  | "launch_game"
  | "submit_score"
  | "view_launcher_status"
  | "access_admin_tools";

type PermissionMap = Record<UserRole, Permission[]>;

export const ROLE_PERMISSIONS: PermissionMap = {
  student: [
    "view_student_dashboard",
    "view_own_scores",
    "view_assignments",
    "view_launcher",
    "launch_game",
    "submit_score",
  ],
  teacher: [
    "view_teacher_dashboard",
    "view_student_metrics",
    "view_assignments",
    "manage_assignments",
    "view_reports",
    "view_launcher",
    "preview_game",
    "launch_game",
    "view_launcher_status",
    "manage_classes",
  ],
  admin: [
    "view_teacher_dashboard",
    "view_student_dashboard",
    "view_editor_dashboard",
    "view_launcher",
    "view_student_metrics",
    "view_own_scores",
    "view_assignments",
    "manage_assignments",
    "edit_content",
    "publish_content",
    "manage_users",
    "manage_classes",
    "view_reports",
    "preview_game",
    "launch_game",
    "submit_score",
    "view_launcher_status",
    "access_admin_tools",
  ],
};

export function hasPermission(
  role: UserRole | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: UserRole | undefined,
  permissions: Permission[]
): boolean {
  if (!role) return false;
  return permissions.some((permission) =>
    ROLE_PERMISSIONS[role].includes(permission)
  );
}

export function hasAllPermissions(
  role: UserRole | undefined,
  permissions: Permission[]
): boolean {
  if (!role) return false;
  return permissions.every((permission) =>
    ROLE_PERMISSIONS[role].includes(permission)
  );
}

/**
 * Route-to-permission mapping
 */
export const ROUTE_PERMISSIONS: Array<{
  pattern: RegExp;
  permission: Permission;
}> = [
  { pattern: /^\/teacher(\/.*)?$/, permission: "view_teacher_dashboard" },
  { pattern: /^\/student(\/.*)?$/, permission: "view_student_dashboard" },
  { pattern: /^\/editor(\/.*)?$/, permission: "view_editor_dashboard" },
  { pattern: /^\/launch(\/.*)?$/, permission: "view_launcher" },
  { pattern: /^\/launcher(\/.*)?$/, permission: "view_launcher" },
  { pattern: /^\/admin(\/.*)?$/, permission: "access_admin_tools" },
];

export function canAccessRoute(
  role: UserRole | undefined,
  pathname: string
): boolean {
  const matchedRoute = ROUTE_PERMISSIONS.find((route) =>
    route.pattern.test(pathname)
  );

  if (!matchedRoute) return true;
  return hasPermission(role, matchedRoute.permission);
}

/**
 * Navigation helpers
 */
export type NavItem = {
  label: string;
  href: string;
  permission?: Permission;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Student", href: "/student", permission: "view_student_dashboard" },
  { label: "Teacher", href: "/teacher", permission: "view_teacher_dashboard" },
  { label: "Editor", href: "/editor", permission: "view_editor_dashboard" },
  { label: "Launch", href: "/launch", permission: "view_launcher" },
  { label: "Admin", href: "/admin", permission: "access_admin_tools" },
];

export function getVisibleNavItems(role: UserRole | undefined): NavItem[] {
  if (!role) return [];

  return NAV_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(role, item.permission);
  });
}

/**
 * Resource ownership helpers
 */
export function canViewStudentData(
  role: UserRole | undefined,
  currentUserId: string | undefined,
  targetUserId: string
): boolean {
  if (!role) return false;

  if (role === "admin" || role === "teacher") return true;
  if (role === "student") return currentUserId === targetUserId;

  return false;
}

export function canEditContent(role: UserRole | undefined): boolean {
  return hasPermission(role, "edit_content");
}

export function canManageAssignments(role: UserRole | undefined): boolean {
  return hasPermission(role, "manage_assignments");
}

export function canLaunchGame(role: UserRole | undefined): boolean {
  return hasPermission(role, "launch_game");
}

export function canSubmitScore(role: UserRole | undefined): boolean {
  return hasPermission(role, "submit_score");
}