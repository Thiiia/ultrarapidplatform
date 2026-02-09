import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function pillStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid #e6e6e6",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700 as const,
    opacity: 0.85,
    background: "white",
  };
}

function cardStyle() {
  return {
    border: "1px solid #e6e6e6",
    borderRadius: 12,
    padding: 14,
    background: "white",
  };
}

export default async function StudentPage() {
  const student = await prisma.user.findFirst({
    where: { role: "student" },
    select: { id: true, name: true },
  });

  if (!student) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.2 }}>
          Student Dashboard
        </h1>
        <p style={{ marginTop: 8 }}>
          No student found. Seed again: <code>npx tsx prisma/seed.ts</code>
        </p>
      </div>
    );
  }

  const missions = await prisma.mission.findMany({
    where: { published: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      progress: {
        where: { userId: student.id },
        select: { status: true, score: true, updatedAt: true },
      },
    },
  });

  const publishedCount = missions.length;
  const inProgressCount = missions.filter((m) => m.progress[0]?.status === "in_progress").length;
  const completedCount = missions.filter((m) => m.progress[0]?.status === "complete").length;

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.3 }}>
        Student Dashboard
      </h1>
      <div style={{ marginTop: 6, opacity: 0.8 }}>
        Welcome{student.name ? `, ${student.name}` : ""}.
      </div>

      {/* Stats */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Published missions</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{publishedCount}</div>
        </div>
        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>In progress</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{inProgressCount}</div>
        </div>
        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Completed</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{completedCount}</div>
        </div>
      </div>

      <h2 style={{ marginTop: 22, fontSize: 18, fontWeight: 900 }}>Published Missions</h2>

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {missions.map((m) => {
          const p = m.progress[0];
          const status = p?.status ?? "not_started";
          const score = p?.score ?? 0;

          return (
            <div key={m.id} style={cardStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{m.title}</div>
                  {m.description ? (
                    <div style={{ marginTop: 6, opacity: 0.8 }}>{m.description}</div>
                  ) : null}

                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={pillStyle()}>Status: {status}</span>
                    <span style={pillStyle()}>Score: {score}</span>
                  </div>
                </div>

                <div style={{ textAlign: "right", minWidth: 180 }}>
                  <Link
                    href={`/launch?missionId=${m.id}`}
                    style={{
                      display: "inline-block",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "white",
                      fontWeight: 900,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    Launch
                  </Link>

                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
                    ID: <code>{m.id}</code>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}