export const SITE_MUSIC_LOADING_EVENT = "ultrarapid:game-loading-music";
const LOADING_STATE_ATTRIBUTE = "data-ultrarapid-game-loading-music";

export function announceGameLoadingMusic(active: boolean) {
  document.documentElement.setAttribute(LOADING_STATE_ATTRIBUTE, String(active));
  window.dispatchEvent(
    new CustomEvent<boolean>(SITE_MUSIC_LOADING_EVENT, { detail: active }),
  );
}

export function isGameLoadingMusicActive() {
  return document.documentElement.getAttribute(LOADING_STATE_ATTRIBUTE) === "true";
}
