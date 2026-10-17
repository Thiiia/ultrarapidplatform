"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isGameLoadingMusicActive, SITE_MUSIC_LOADING_EVENT } from "@/lib/site-music";
import styles from "./global-site-music.module.css";

const PREFERENCE_KEY = "ultrarapid:site-music:v1";
const DEFAULT_VOLUME = 18;

type StoredMusicPreference = {
  volume?: number;
  muted?: boolean;
};

export default function GlobalSiteMusic({ src }: { src: string | null }) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isGameLoading, setIsGameLoading] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [isMuted, setIsMuted] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const isIntroRoute = pathname === "/";
  const canOfferMusic = isIntroRoute || isGameLoading;
  const shouldPlay = Boolean(src) && preferencesReady && canOfferMusic && !isMuted && volume > 0;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PREFERENCE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredMusicPreference;
        if (typeof parsed.volume === "number" && Number.isFinite(parsed.volume)) {
          setVolume(Math.max(0, Math.min(100, Math.round(parsed.volume))));
        }
        if (typeof parsed.muted === "boolean") setIsMuted(parsed.muted);
      }
    } catch {
      // Keep the in-memory default when storage is unavailable.
    }
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    setIsGameLoading(isGameLoadingMusicActive());
    const handleLoadingState = (event: Event) => {
      setIsGameLoading((event as CustomEvent<boolean>).detail === true);
    };

    window.addEventListener(SITE_MUSIC_LOADING_EVENT, handleLoadingState);
    return () => window.removeEventListener(SITE_MUSIC_LOADING_EVENT, handleLoadingState);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      window.localStorage.setItem(
        PREFERENCE_KEY,
        JSON.stringify({ volume, muted: isMuted }),
      );
    } catch {
      // Audio remains adjustable for this page when storage is unavailable.
    }
  }, [isMuted, preferencesReady, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, volume / 100));
    audio.muted = isMuted || volume === 0;
  }, [isMuted, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const removeGestureListeners = () => {
      document.removeEventListener("pointerdown", handleUserGesture);
      document.removeEventListener("keydown", handleUserGesture);
    };

    const handleUserGesture = () => {
      void audio.play().then(removeGestureListeners).catch(() => {});
    };

    if (!shouldPlay) {
      audio.pause();
      audio.currentTime = 0;
      removeGestureListeners();
      return;
    }

    void audio.play().catch(() => {
      // Browsers may require the first user gesture before intro music can play.
    });
    document.addEventListener("pointerdown", handleUserGesture);
    document.addEventListener("keydown", handleUserGesture);

    return () => {
      audio.pause();
      audio.currentTime = 0;
      removeGestureListeners();
    };
  }, [shouldPlay]);

  if (!src) return null;

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="none" aria-hidden="true" />
      {canOfferMusic ? (
        <div className={styles.control} data-playing={shouldPlay ? "true" : "false"}>
          <button
            className={styles.muteButton}
            type="button"
            aria-label={isMuted || volume === 0 ? "Unmute intro music" : "Mute intro music"}
            aria-pressed={isMuted || volume === 0}
            title={isMuted || volume === 0 ? "Unmute intro music" : "Mute intro music"}
            onClick={() => {
              if (isMuted || volume === 0) {
                setIsMuted(false);
                if (volume === 0) setVolume(DEFAULT_VOLUME);
              } else {
                setIsMuted(true);
              }
            }}
          >
            {isMuted || volume === 0 ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M4 9v6h4l5 4V5L8 9H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="m17 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M4 9v6h4l5 4V5L8 9H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <label className={styles.volumeControl}>
            <span>Intro music <strong>{volume}%</strong></span>
            <input
              aria-label="Intro music volume"
              type="range"
              min="0"
              max="100"
              step="1"
              value={volume}
              aria-valuetext={`${isMuted ? "Muted, " : ""}${volume}%`}
              onChange={(event) => {
                const nextVolume = Number(event.currentTarget.value);
                setVolume(nextVolume);
                if (nextVolume > 0) setIsMuted(false);
              }}
            />
          </label>
        </div>
      ) : null}
    </>
  );
}
