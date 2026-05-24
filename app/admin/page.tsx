import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import type { Role, UserStatus } from "@prisma/client";

type AdminUserRow = {
  id: string;
  auth0Sub: string;
  email: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  schoolId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

async function updateUserRole(formData: FormData) {
  "use server";

  const currentUser = await getCurrentAppUser();

  if (!currentUser || currentUser.role !== "admin") {
    redirect("/login");
  }

  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "");

  if (!userId || !["student", "teacher", "admin"].includes(role)) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: role as "student" | "teacher" | "admin" },
  });
}

export default async function AdminPage() {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "admin") {
    redirect("/student");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111827",
        color: "#FFFFFF",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 36 }}>Admin Role Management</h1>
            <p style={{ margin: "8px 0 0 0", color: "#D1D5DB" }}>
              Change roles and open any student or teacher dashboard.
            </p>
          </div>

          <a
            href="/auth/logout"
            style={{
              textDecoration: "none",
              background: "#DC2626",
              color: "#FFFFFF",
              padding: "12px 16px",
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            Log out
          </a>
        </div>

        <div
          style={{
            background: "#1F2937",
            border: "1px solid #374151",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ background: "#111827" }}>
                <th style={{ padding: 16, textAlign: "left" }}>Name</th>
                <th style={{ padding: 16, textAlign: "left" }}>Email</th>
                <th style={{ padding: 16, textAlign: "left" }}>Current Role</th>
                <th style={{ padding: 16, textAlign: "left" }}>Change Role</th>
                <th style={{ padding: 16, textAlign: "left" }}>Open Dashboard</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: AdminUserRow) => {
                const canOpen =
                  user.role === "student" || user.role === "teacher";

                return (
                  <tr
                    key={user.id}
                    style={{
                      borderTop: "1px solid #374151",
                    }}
                  >
                    <td style={{ padding: 16 }}>{user.name || "—"}</td>
                    <td style={{ padding: 16 }}>{user.email}</td>
                    <td style={{ padding: 16, textTransform: "capitalize" }}>
                      {user.role}
                    </td>
                    <td style={{ padding: 16 }}>
                      <form action={updateUserRole} style={{ display: "flex", gap: 12 }}>
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="role"
                          defaultValue={user.role}
                          style={{
                            background: "#111827",
                            color: "#FFFFFF",
                            border: "1px solid #4B5563",
                            borderRadius: 8,
                            padding: "10px 12px",
                          }}
                        >
                          <option value="student">student</option>
                          <option value="teacher">teacher</option>
                          <option value="admin">admin</option>
                        </select>
                        <button
                          type="submit"
                          style={{
                            background: "#16A34A",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: 8,
                            padding: "10px 14px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Save
                        </button>
                      </form>
                    </td>
                    <td style={{ padding: 16 }}>
                      {canOpen ? (
                        <a
                          href={`/admin/users/${user.id}`}
                          style={{
                            textDecoration: "none",
                            background: "#2563EB",
                            color: "#FFFFFF",
                            padding: "10px 14px",
                            borderRadius: 8,
                            fontWeight: 600,
                            display: "inline-flex",
                          }}
                        >
                          Open
                        </a>
                      ) : (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
