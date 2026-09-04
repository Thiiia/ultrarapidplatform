"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SILENT_PATHS = [
  "/launch",
  "/demo/launch",
  "/student/game",
  "/teacher/game",
  "/demo/student/game",
  "/demo/teacher/game",
  "/admin/users/",
  "/team/editor",
  "/student/lesson-builder",
  "/teacher/lesson-builder",
  "/demo/student/lesson-builder",
  "/demo/teacher/lesson-builder",
];

function isSilentPath(pathname: string) {
  return SILENT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default function GlobalSiteMusic({ src }: { src: string | null }) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldPlay = Boolean(src) && !isSilentPath(pathname);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !shouldPlay) {
      audio?.pause();
      return;
    }

    const play = () => {
      void audio.play().catch(() => {
        // Unmuted autoplay requires a user gesture in some browsers.
      });
    };

    const handleUserGesture = () => {
      play();
      document.removeEventListener("pointerdown", handleUserGesture);
      document.removeEventListener("keydown", handleUserGesture);
    };

    play();
    document.addEventListener("pointerdown", handleUserGesture, { once: true });
    document.addEventListener("keydown", handleUserGesture, { once: true });

    return () => {
      audio.pause();
      document.removeEventListener("pointerdown", handleUserGesture);
      document.removeEventListener("keydown", handleUserGesture);
    };
  }, [shouldPlay]);

  if (!src) return null;

  return <audio ref={audioRef} src={src} loop preload="auto" aria-hidden="true" />;
}