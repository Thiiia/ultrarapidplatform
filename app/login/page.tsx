import Link from "next/link";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawError = Array.isArray(params?.error) ? params.error[0] : params?.error;
  const errorMessage =
    rawError === "no_user_record"
      ? "This sign-in isn't linked to an Ultra Rapid school account yet. Ask your teacher or school administrator to check your access."
      : rawError
        ? "We couldn't complete sign-in. Try again, or contact your school administrator if the problem continues."
        : null;

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="platform-login-title">
        <Link className={styles.brand} href="/" aria-label="Ultra Rapid home">
          ULTRA RAPID
        </Link>
        <h1 className={styles.title} id="platform-login-title">
          Sign in to Ultra Rapid.
        </h1>
        <p className={styles.intro}>
          Continue to your school&apos;s secure sign-in page. Your school may ask for an email or
          username and password, or use another sign-in method.
        </p>

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className={styles.actions}>
          <a className={styles.primaryAction} href="/auth/login?returnTo=%2Fapi%2Fpost-login">
            Continue securely <span aria-hidden="true">→</span>
          </a>
          <p className={styles.accessPrompt}>
            Need school access?{" "}
            <a href="https://ultrarapid.io/access">Explore School Access</a>
          </p>
          <Link className={styles.homeLink} href="/">
            Back to home
          </Link>
        </div>

        <p className={styles.securityNote}>
          Enter your password on the secure sign-in page, not on this screen.
        </p>
      </section>
    </main>
  );
}
