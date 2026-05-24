import Link from "next/link";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#111827",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#1F2937",
          border: "1px solid #374151",
          borderRadius: 16,
          padding: 32,
          color: "#FFFFFF",
        }}
      >
        <h1 style={{ margin: "0 0 12px 0", fontSize: 32 }}>Sign in</h1>

        <p style={{ margin: "0 0 24px 0", color: "#D1D5DB", lineHeight: 1.5 }}>
          Sign in securely to access your dashboard.
        </p>

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              borderRadius: 10,
              background: "#7F1D1D",
              border: "1px solid #B91C1C",
              color: "#FEE2E2",
            }}
          >
            {error === "no_user_record"
              ? "Your account is not provisioned yet."
              : "There was a problem signing you in."}
          </div>
        )}

        <a href="/auth/login?returnTo=/api/post-login">Continue to sign in</a>
      </div>
    </main>
  );
}