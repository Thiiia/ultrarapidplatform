import LaunchEmbedPage from "@/app/components/LaunchEmbedPage";
import { getStorageSignedUrl } from "@/lib/storage-media";

export const dynamic = "force-dynamic";

export default async function DemoLaunchPage() {
  const videoUrl = await getStorageSignedUrl("Videos", "Bars.mp4");

  return <LaunchEmbedPage videoUrl={videoUrl} />;
}