export default function LaunchPage() {
  return (
    <div>
      <h1>Game Launcher</h1>

      <section style={{
        border: "1px solid #333",
        padding: 24,
        marginTop: 20
      }}>
        <p>Unity WebGL build will load here</p>
        <button style={{ marginTop: 12 }}>
          Launch Game
        </button>
      </section>
    </div>
  );
}
