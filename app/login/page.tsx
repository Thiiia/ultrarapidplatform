export default function LoginPage() {
  return (
    <main style={{ padding: 40, maxWidth: 520 }}>
      <h1>Login</h1>
      <p>Choose a role (mock login for now).</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <form action="/api/login" method="POST">
          <input type="hidden" name="role" value="student" />
          <button type="submit">Login as Student</button>
        </form>

        <form action="/api/login" method="POST">
          <input type="hidden" name="role" value="teacher" />
          <button type="submit">Login as Teacher</button>
        </form>
      </div>

      <form action="/api/logout" method="POST" style={{ marginTop: 16 }}>
        <button type="submit">Logout</button>
      </form>
    </main>
  );
}
