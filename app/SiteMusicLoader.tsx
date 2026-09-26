import GlobalSiteMusic from "@/app/GlobalSiteMusic";
import { getStorageSignedUrl } from "@/lib/storage-media";

export default async function SiteMusicLoader() {
  const siteMusicUrl = await getStorageSignedUrl(
    "Songs",
    "Lofries _New_Orleanz_title.mp3",
  );

  return <GlobalSiteMusic src={siteMusicUrl} />;
}
