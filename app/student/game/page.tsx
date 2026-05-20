import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import GameEmbedPage from "./GameEmbedPage";

export default async function StudentGamePage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role !== "student") {
    redirect("/teacher");
  }

  return <GameEmbedPage navBasePath="/student" />;
}