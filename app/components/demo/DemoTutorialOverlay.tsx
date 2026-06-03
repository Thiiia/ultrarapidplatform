"use client";

import { useEffect, useMemo, useState } from "react";

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type DemoTutorialOverlayProps = {
  active: boolean;
  targetSelector: string;
  allowedSelector: string;
  title?: string;
  body: string;
  blockedMessage?: string;
};

export default function DemoTutorialOverlay({
  active,
  targetSelector,
  allowedSelector,
  title = "Demo walkthrough",
  body,
  blockedMessage = "Please follow the directions to continue the demo.",
}: DemoTutorialOverlayProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [blockedNoticeVisible, setBlockedNoticeVisible] = useState(false);

  useEffect(() => {
    if (!active) return;

    function updateTargetRect() {
      const target = document.querySelector(targetSelector);

      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();

      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }

    updateTargetRect();

    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [active, targetSelector]);

  useEffect(() => {
    if (!active) return;

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (!target) return;

      const allowedTarget = target.closest(allowedSelector);

      if (allowedTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setBlockedNoticeVisible(true);

      window.setTimeout(() => {
        setBlockedNoticeVisible(false);
      }, 1800);
    }

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [active, allowedSelector]);

  const spotlightStyle = useMemo(() => {
    if (!targetRect) return null;

    return {
      top: targetRect.top - 10,
      left: targetRect.left - 10,
      width: targetRect.width + 20,
      height: targetRect.height + 20,
    };
  }, [targetRect]);

  if (!active) {
    return null;
  }

  return (
    <>
      {spotlightStyle ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            ...spotlightStyle,
            borderRadius: 16,
            border: "2px solid #CFFF04",
            boxShadow:
              "0 0 0 9999px rgba(0, 0, 0, 0.68), 0 0 34px rgba(207, 255, 4, 0.42)",
            zIndex: 9000,
            pointerEvents: "none",
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.68)",
            zIndex: 9000,
            pointerEvents: "none",
          }}
        />
      )}

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(460px, calc(100vw - 40px))",
          background: "#2B2B2B",
          color: "#FFFFFF",
          border: "1px solid #FFFFFF14",
          borderRadius: 18,
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.55)",
          padding: 24,
          boxSizing: "border-box",
          zIndex: 9001,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <p
          style={{
            margin: "0 0 8px 0",
            color: "#CFFF04",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {title}
        </p>

        <p
          style={{
            margin: 0,
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 600,
            lineHeight: "24px",
          }}
        >
          {body}
        </p>
      </section>

      {blockedNoticeVisible ? (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 32,
            transform: "translateX(-50%)",
            background: "#2B2B2B",
            color: "#FFFFFF",
            border: "1px solid #CFFF04",
            borderRadius: 999,
            padding: "10px 16px",
            boxShadow: "0 14px 40px rgba(0, 0, 0, 0.45)",
            zIndex: 9002,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {blockedMessage}
        </div>
      ) : null}
    </>
  );
}