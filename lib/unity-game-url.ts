export const DEFAULT_UNITY_GAME_URL = "https://ultrarapidtest.netlify.app/";

export function getUnityGameUrl() {
  return process.env.NEXT_PUBLIC_GAME_URL ?? DEFAULT_UNITY_GAME_URL;
}
