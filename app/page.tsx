import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const role = (await cookies()).get("role")?.value;
/*
  if (!role) redirect("/login");
  if (role === "teacher") redirect("/teacher");

  if (role === "student") redirect("/student");
*/

redirect("/login");

}
// trigger vercel deploy
