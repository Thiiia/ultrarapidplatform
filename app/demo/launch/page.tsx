import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type LaunchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DemoLaunchPage({ searchParams }: LaunchPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value.length > 0) query.set(key, value[0]);
  }

  redirect(`/demo/student/game${query.toString() ? `?${query.toString()}` : ""}`);
}
