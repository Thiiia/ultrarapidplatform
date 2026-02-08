import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value;

  if (!role) redirect("/login");
  if (role === "teacher") redirect("/teacher");
  redirect("/student");
}
