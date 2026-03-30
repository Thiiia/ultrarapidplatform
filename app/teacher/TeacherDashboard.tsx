export default function TeacherDashboard({
  adminViewing = false,
  viewedUserName,
  viewedUserEmail,
}: {
  adminViewing?: boolean;
  viewedUserName?: string | null;
  viewedUserEmail?: string;
}) {
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
                ? `Viewing ${viewedUserName || viewedUserEmail || "teacher"} as admin.`
                : "Manage students, lessons, and classroom activity."}
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
          }}
        >
          <section
            style={{
              background: "#1F2937",
              border: "1px solid #374151",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Class Overview</h2>
            <p style={{ color: "#D1D5DB" }}>
              View active students, assignments due, and recent activity.
            </p>
          </section>

          <section
            style={{
              background: "#1F2937",
              border: "1px solid #374151",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Lesson Management</h2>
            <p style={{ color: "#D1D5DB" }}>
              Create lessons, assign practice, and review progress.
            </p>
          </section>

          <section
            style={{
              background: "#1F2937",
              border: "1px solid #374151",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Reports</h2>
            <p style={{ color: "#D1D5DB" }}>
              Track engagement, scores, and completion across students.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}