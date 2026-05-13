import type { TeacherDashboardData } from "@/lib/teacher-dashboard";

type TeacherDashboardProps = {
  dashboardData: TeacherDashboardData;
  adminViewing?: boolean;
  viewedUserName?: string | null;
  viewedUserEmail?: string;
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "No due date";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <section
      style={{
        background: "#1F2937",
        border: "1px solid #374151",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <p style={{ margin: 0, color: "#9CA3AF", fontSize: 14 }}>{title}</p>
      <h2 style={{ margin: "8px 0", fontSize: 36 }}>{value}</h2>
      <p style={{ margin: 0, color: "#D1D5DB" }}>{description}</p>
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#1F2937",
        border: "1px solid #374151",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function TeacherDashboard({
  dashboardData,
  adminViewing = false,
  viewedUserName,
  viewedUserEmail,
}: TeacherDashboardProps) {
  const teacherName =
    viewedUserName ??
    dashboardData.name ??
    viewedUserEmail ??
    dashboardData.email;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111827",
        color: "#FFFFFF",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 36 }}>
              {adminViewing ? "Teacher Dashboard Preview" : "Teacher Dashboard"}
            </h1>
            <p style={{ margin: "8px 0 0 0", color: "#D1D5DB" }}>
              {adminViewing
                ? `Viewing ${teacherName} as admin.`
                : `Welcome back, ${teacherName}.`}
            </p>
            <p style={{ margin: "6px 0 0 0", color: "#9CA3AF" }}>
              School: {dashboardData.school?.name ?? "Not assigned"}
            </p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {adminViewing ? (
              <a
                href="/admin"
                style={{
                  textDecoration: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  padding: "12px 16px",
                  borderRadius: 10,
                  fontWeight: 600,
                }}
              >
                Back to Admin
              </a>
            ) : (
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
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <StatCard
            title="Classes"
            value={dashboardData.totals.classCount}
            description="Active classes assigned to this teacher."
          />

          <StatCard
            title="Students"
            value={dashboardData.totals.studentCount}
            description="Unique students across all classes."
          />

          <StatCard
            title="Active Assignments"
            value={dashboardData.totals.activeAssignmentCount}
            description="Assigned or in-progress work."
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <Panel title="Classes">
            {dashboardData.classes.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                {dashboardData.classes.map((classItem) => (
                  <div
                    key={classItem.id}
                    style={{
                      border: "1px solid #374151",
                      borderRadius: 12,
                      padding: 16,
                      background: "#111827",
                    }}
                  >
                    <h3 style={{ margin: "0 0 6px 0" }}>{classItem.name}</h3>
                    <p style={{ margin: "0 0 10px 0", color: "#D1D5DB" }}>
                      {classItem.studentCount} student
                      {classItem.studentCount === 1 ? "" : "s"}
                    </p>

                    {classItem.assignments.length > 0 ? (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          color: "#D1D5DB",
                        }}
                      >
                        {classItem.assignments.slice(0, 3).map((assignment) => (
                          <li key={assignment.id}>
                            {assignment.title} — {assignment.status} —{" "}
                            {formatDate(assignment.dueAt)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ margin: 0, color: "#9CA3AF" }}>
                        No assignments yet.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#D1D5DB" }}>
                No classes have been assigned yet.
              </p>
            )}
          </Panel>

          <Panel title="Students">
            {dashboardData.students.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                {dashboardData.students.slice(0, 8).map((student) => (
                  <div
                    key={student.id}
                    style={{
                      borderBottom: "1px solid #374151",
                      paddingBottom: 12,
                    }}
                  >
                    <strong>{student.name ?? student.email}</strong>
                    <p style={{ margin: "4px 0 0 0", color: "#D1D5DB" }}>
                      {student.classNames.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#D1D5DB" }}>
                No students have been assigned yet.
              </p>
            )}
          </Panel>

          <Panel title="Recent Lessons">
            {dashboardData.authoredMissions.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                {dashboardData.authoredMissions.map((mission) => (
                  <div
                    key={mission.id}
                    style={{
                      border: "1px solid #374151",
                      borderRadius: 12,
                      padding: 16,
                      background: "#111827",
                    }}
                  >
                    <h3 style={{ margin: "0 0 6px 0" }}>{mission.title}</h3>
                    <p style={{ margin: "0 0 8px 0", color: "#D1D5DB" }}>
                      {mission.description ?? "No description"}
                    </p>
                    <p style={{ margin: 0, color: "#9CA3AF" }}>
                      {mission.published ? "Published" : "Draft"} • Updated{" "}
                      {formatDate(mission.updatedAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#D1D5DB" }}>
                No authored lessons yet.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}