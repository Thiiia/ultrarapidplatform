import { redirect } from "next/navigation";
import { getAuth0 } from "@/lib/auth0";

export default async function HomePage() {
  const session = await getAuth0().getSession();

  if (!session?.user) {
    redirect("/auth/login?returnTo=/api/post-login");
  }

  redirect("/api/post-login");
}