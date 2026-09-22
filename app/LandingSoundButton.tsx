"use client";

import { useRef, useState } from "react";

type LandingSoundButtonProps = {
  src: string | null;
};

export default function LandingSoundButton({ src }: LandingSoundButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  async function handleToggleSound() {
    const audio = audioRef.current;

    if (!audio || !src) {
      return;
    }

    try {
      setPlaybackError(null);

      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        return;
      }

      audio.volume = 0.65;
      await audio.play();
      setIsPlaying(true);
    } catch {
      setPlaybackError("Music could not start. Try again.");
      setIsPlaying(false);
    }
  }

  return (
    <>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          loop
          preload="auto"
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onError={() => {
            setPlaybackError("Music is unavailable right now.");
            setIsPlaying(false);
          }}
        />
      ) : null}

      <button
        type="button"
        onClick={handleToggleSound}
        aria-label={isPlaying ? "Pause music" : "Play music"}
        aria-describedby={playbackError ? "landing-music-status" : undefined}
        disabled={!src}
        title={playbackError ?? undefined}
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          width: 38,
          height: 38,
          borderRadius: "999px",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          background: "rgba(255, 255, 255, 0.10)",
          color: "#FFFFFF",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: src ? "pointer" : "not-allowed",
          opacity: src ? 1 : 0.45,
          backdropFilter: "blur(8px)",
          padding: 0,
          zIndex: 4,
        }}
      >
        {isPlaying ? (
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M4 9V15H8L13 19V5L8 9H4Z"
              fill="currentColor"
            />
            <path
              d="M16.5 8.5C17.4 9.4 17.9 10.6 17.9 12C17.9 13.4 17.4 14.6 16.5 15.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M19 6C20.5 7.6 21.3 9.7 21.3 12C21.3 14.3 20.5 16.4 19 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M4 9V15H8L13 19V5L8 9H4Z"
              fill="currentColor"
            />
            <path
              d="M16 9L21 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M21 9L16 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
      {playbackError ? (
        <span
          id="landing-music-status"
          role="status"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {playbackError}
        </span>
      ) : null}
    </>
  );
}
