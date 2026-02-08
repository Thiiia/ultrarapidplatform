export default function StudentPage() {
  return (
    <div>
      <h1>Student Dashboard</h1>

      <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
        
        <section style={{ border: "1px solid #333", padding: 16 }}>
          <h2>Active Missions</h2>
          <p>Mission cards will appear here</p>
        </section>

        <section style={{ border: "1px solid #333", padding: 16 }}>
          <h2>Progress</h2>
          <p>Progress charts will appear here</p>
        </section>

        <section style={{ border: "1px solid #333", padding: 16 }}>
          <h2>Recent Activity</h2>
          <p>Recent runs and scores will appear here</p>
        </section>

      </div>
    </div>
  );
}
