import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function cardStyle() {
  return {
    border: "1px solid #e6e6e6",
    borderRadius: 12,
    padding: 14,
    background: "white",
  };
}

function pillStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid #e6e6e6",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800 as const,
    opacity: 0.85,
    background: "white",
  };
}

export default async function TeacherPage() {
  const teacher = await prisma.user.findFirst({
    where: { role: "teacher" },
    select: { id: true, name: true },
  });

  if (!teacher) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Teacher Dashboard</h1>
        <p style={{ marginTop: 8 }}>
          No teacher found. Seed again: <code>npx tsx prisma/seed.ts</code>
        </p>
      </div>
    );
  }

  const missions = await prisma.mission.findMany({
    where: { authorId: teacher.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      published: true,
      _count: { select: { progress: true } },
      updatedAt: true,
    },
  });

  const total = missions.length;
  const published = missions.filter((m) => m.published).length;
  const drafts = total - published;

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.3 }}>
        Teacher Dashboard
      </h1>
      <div style={{ marginTop: 6, opacity: 0.8 }}>
        Welcome{teacher.name ? `, ${teacher.name}` : ""}.
      </div>

      {/* Stats */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Total missions</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{total}</div>
        </div>
        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Published</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{published}</div>
        </div>
        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Drafts</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{drafts}</div>
        </div>
      </div>

      <h2 style={{ marginTop: 22, fontSize: 18, fontWeight: 900 }}>Your Missions</h2>

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {missions.map((m) => (
          <div key={m.id} style={cardStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{m.title}</div>
                {m.description ? (
                  <div style={{ marginTop: 6, opacity: 0.8 }}>{m.description}</div>
                ) : null}

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={pillStyle()}>{m.published ? "Published" : "Draft"}</span>
                  <span style={pillStyle()}>Progress records: {m._count.progress}</span>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
                  ID: <code>{m.id}</code>
                </div>
              </div>

              <div style={{ textAlign: "right", minWidth: 160, opacity: 0.7, fontSize: 12 }}>
                Updated<br />
                <strong style={{ fontSize: 13 }}>{new Date(m.updatedAt).toLocaleString()}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}