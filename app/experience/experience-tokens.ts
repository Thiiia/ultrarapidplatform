// Generated from ultrarapid.experience 1.1.0; edit contract sources, not this file.
export const experienceTokens = {
  contract: "ultrarapid.experience",
  version: "1.1.0",
  colors:   {
      "--ur-canvas-top": "#082733",
      "--ur-canvas-deep": "#030E14",
      "--ur-canvas-neutral": "#191919",
      "--ur-text-primary": "#FFFFFF",
      "--ur-text-marketing": "#F4F5ED",
      "--ur-accent-lime": "#CFFF04",
      "--ur-accent-purple": "#6F00F6",
      "--ur-feedback-error": "#FF4747",
      "--ur-feedback-success": "#00FF57",
      "--ur-feedback-warning": "#FFC42E",
      "--ur-feedback-timing": "#FFDD00",
      "--color-ink": "#F4F5ED",
      "--color-ink-muted": "#A9B2AC",
      "--color-ink-faint": "#73817B",
      "--color-lime": "#CFFF04",
      "--color-lime-dark": "#95C400",
      "--color-background": "#030E14",
      "--color-background-deep": "#030E14",
      "--color-surface": "#082733",
      "--color-surface-raised": "#103336",
      "--color-border": "#214346",
      "--color-border-strong": "#477171",
      "--color-blue": "#66B8FF",
      "--color-orange": "#FF9B5D",
      "--color-purple": "#B796FF",
      "--color-success": "#00FF57",
      "--color-error": "#FF4747"
  },
  spacingPx:   {
      "1": 4,
      "2": 8,
      "3": 12,
      "4": 16,
      "5": 24,
      "6": 32,
      "7": 48,
      "8": 64,
      "section": 96
  },
  targetPx:   {
      "minimumWeb": 44,
      "prominentGameplay": 52
  },
  radiusPx:   {
      "small": 4,
      "medium": 8,
      "large": 16,
      "pill": 999
  },
  elevation:   {
      "raised": {
          "x": 0,
          "y": 4,
          "blur": 16,
          "spread": 0,
          "color": "#000000",
          "opacity": 24
      },
      "overlay": {
          "x": 0,
          "y": 12,
          "blur": 32,
          "spread": 0,
          "color": "#000000",
          "opacity": 35
      }
  },
  typography:   {
      "families": {
          "marketingDisplay": {
              "family": "Dela Gothic One",
              "source": "Already used by the public website; reuse the same Google Fonts source where fonts are not bundled."
          },
          "interface": {
              "family": "Space Grotesk",
              "source": "Already used by the public website; use in platform and Unity chrome only when the existing asset/runtime permits."
          },
          "technicalMono": {
              "family": "Geist Mono",
              "fallback": "ui-monospace, SFMono-Regular, Consolas, monospace",
              "source": "Use for technical identifiers and chart data; Figma font availability verified."
          },
          "gameplay": {
              "family": "Keep verified Unity TextMeshPro gameplay face",
              "source": "Retain the existing gameplay glyph font; do not substitute a browser or marketing font."
          }
      },
      "roles": {
          "display": {
              "family": "marketingDisplay",
              "size": 48,
              "lineHeight": 54,
              "letterSpacing": -0.96,
              "weight": 400,
              "textCase": "none"
          },
          "heading": {
              "family": "interface",
              "size": 28,
              "lineHeight": 34,
              "letterSpacing": -0.4,
              "weight": 700,
              "textCase": "none"
          },
          "body": {
              "family": "interface",
              "size": 16,
              "lineHeight": 24,
              "letterSpacing": 0,
              "weight": 400,
              "textCase": "none"
          },
          "label": {
              "family": "interface",
              "size": 14,
              "lineHeight": 20,
              "letterSpacing": 0.1,
              "weight": 500,
              "textCase": "none"
          },
          "technical": {
              "family": "technicalMono",
              "size": 12,
              "lineHeight": 18,
              "letterSpacing": 0,
              "weight": 400,
              "textCase": "none"
          }
      }
  },
  durationMs:   {
      "respond": 120,
      "commit": 180,
      "reject": 180,
      "resolve": 280,
      "transition": 280,
      "ambient": 1400
  },
  easings:   {
      "cubicOut": "cubic-bezier(0, 0, 0.2, 1)",
      "cubicIn": "cubic-bezier(0.4, 0, 1, 1)",
      "outBack": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      "sineInOut": "cubic-bezier(0.37, 0, 0.63, 1)",
      "quartOut": "cubic-bezier(0.22, 1, 0.36, 1)",
      "cubicSettle": "cubic-bezier(0.22, 0.61, 0.36, 1)"
  },
  recipes:   {
      "respond": {
          "trigger": "A button or selectable control receives pointer, touch, keyboard, or controller activation.",
          "properties": [
              "transform.scale: 1 → 0.98",
              "surface or outline contrast increases"
          ],
          "duration": "respond",
          "easing": "cubicOut",
          "interruption": "Reverse to the rest state on release, cancel, blur, or a newer input.",
          "completionState": "Control returns to its rest state; focus remains visible when keyboard initiated.",
          "audioClock": "Independent UI response; never advances gameplay or transport.",
          "reducedMotion": "Use a static pressed surface and outline change without transform."
      },
      "commit": {
          "trigger": "The owner confirms a selection, recording, save, or step change.",
          "properties": [
              "outline or fill changes to the committed semantic",
              "optional scale 0.98 → 1"
          ],
          "duration": "commit",
          "easing": "quartOut",
          "interruption": "A newer owner state replaces the transition; cleanup restores the latest owner state.",
          "completionState": "The control visibly reflects the committed value and remains operable.",
          "audioClock": "The state event starts the cue. Elapsed UI time does not commit data or affect song time.",
          "reducedMotion": "Apply the final committed fill, outline, and text state immediately."
      },
      "reject": {
          "trigger": "Validation or an authoritative interaction handler reports a rejected action.",
          "properties": [
              "error outline and icon",
              "optional horizontal offset of at most 4px"
          ],
          "duration": "reject",
          "easing": "cubicOut",
          "interruption": "Cancel on a new attempt, route change, teardown, or when the owner clears the error.",
          "completionState": "Error remains described in text and is not conveyed by color alone.",
          "audioClock": "Triggered only by the rejection event; it does not schedule a judgement.",
          "reducedMotion": "Show the error outline, icon, and message without movement."
      },
      "resolve": {
          "trigger": "The authoritative encounter or save owner confirms a resolved outcome.",
          "properties": [
              "opacity and scale settle to the resolved state",
              "success or error icon and text"
          ],
          "duration": "resolve",
          "easing": "cubicSettle",
          "interruption": "Cancel and rebind to the newest owner result on retry, reset, or teardown.",
          "completionState": "The UI mirrors the confirmed result; this recipe never decides success or failure.",
          "audioClock": "Start only after the existing judgement/result callback. Do not add a timer or second gameplay clock.",
          "reducedMotion": "Set the confirmed result and semantic icon immediately."
      },
      "transition": {
          "trigger": "The user or existing router changes page, step, or panel.",
          "properties": [
              "opacity",
              "translateY up to 8px"
          ],
          "duration": "transition",
          "easing": "quartOut",
          "interruption": "Cancel on a newer route/step event and clean up on unmount.",
          "completionState": "The destination is interactive with focus moved to its heading when appropriate.",
          "audioClock": "Independent of the song clock and never indicates Unity readiness.",
          "reducedMotion": "Replace movement and fading with an immediate state change."
      },
      "ambient": {
          "trigger": "A ready, focused, non-gameplay element is idle and visible.",
          "properties": [
              "low-opacity outline glow only",
              "no position or scale change"
          ],
          "duration": "ambient",
          "easing": "sineInOut",
          "interruption": "Pause when hidden or unfocused; remove on state change, teardown, or reduced motion.",
          "completionState": "Returns to its quiet rest state and never masks an interaction state.",
          "audioClock": "Independent. Never runs against gameplay timing or conveys readiness.",
          "reducedMotion": "Keep a static focus outline with no pulsing."
      }
  },
} as const;

export type ExperienceColorVariable = keyof typeof experienceTokens.colors;
export type ExperienceMotionRecipe = keyof typeof experienceTokens.recipes;
