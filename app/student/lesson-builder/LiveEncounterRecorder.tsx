"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SwipeRoundedIcon from "@mui/icons-material/SwipeRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import SpinIcon from "@/public/lesson_builder_icons/Spin.svg";
import { PLAYER_HEX_AUTHORED_HIT_PADS, resolveAuthoredHitPadSlot, resolvePlayerHexHitPadPixelOffset, type AuthoredHitPad } from "@/lib/authored-hit-pad-layout";
import algebraStyles from "./AlgebraStudio.module.css";
import { findNearestChartCueIndex } from "@/lib/editor/chart-cue-navigation";
import { getRecorderPresentationState } from "@/lib/editor/presentation-state";
type GameplayMechanic = "hit" | "spin" | "drag";
type HitBubblePad = AuthoredHitPad;
const gameplayMechanics: GameplayMechanic[] = ["hit", "spin", "drag"];

function getHitBubblePadStyle(pad: HitBubblePad, orbitRadius: number, layoutVersion = 2) {
  const offset = resolvePlayerHexHitPadPixelOffset(resolveAuthoredHitPadSlot(pad, layoutVersion), orbitRadius);
  if (!offset) return {};
  return {
    left: `calc(50% ${offset.dx < 0 ? "-" : "+"} ${Math.abs(offset.dx).toFixed(2)}px)`,
    top: `calc(50% ${offset.dy < 0 ? "-" : "+"} ${Math.abs(offset.dy).toFixed(2)}px)`,
    transform: "translate(-50%, -50%)",
  };
}
function getHitPadNumber(pad: HitBubblePad, layoutVersion = 2) {
  const slot = resolveAuthoredHitPadSlot(pad, layoutVersion);
  return slot >= 0 ? slot + 1 : null;
}
function formatSongTime(seconds: number, showHundredths = false) {
  const total = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 100));
  const whole = Math.floor(total / 100);
  const time = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  return showHundredths ? `${time}.${String(total % 100).padStart(2, "0")}` : time;
}

function RtcmBlankNumberToken({
  size = 68,
  borderColor = "#64A0FF73",
  background = "#1B3668",
}: {
  size?: number;
  borderColor?: string;
  background?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={algebraStyles.rtcmBlankToken}
      style={{
        width: size,
        minWidth: size,
        height: Math.max(34, Math.round(size * 0.82)),
        border: `1px solid ${borderColor}`,
        borderRadius: 999,
        background,
        boxShadow: "inset 0 1px rgba(255,255,255,.28), 0 8px 20px rgba(0,0,0,.26)",
        color: "transparent",
        textShadow: "none",
      }}
    >
      0
    </span>
  );
}

function RtcmHitPadToken({
  onAddHit,
  isSongPlaying,
}: {
  onAddHit: (pad: HitBubblePad) => void;
  isSongPlaying: boolean;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState(300);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width);
      if (nextWidth > 0) setStageWidth((current) => Math.abs(current - nextWidth) > 1 ? nextWidth : current);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const scale = stageWidth / 300;
  const emptyTokenSize = Math.round(56 * scale);
  const hitPadDiameter = Math.max(44, Math.round(64 * scale));
  const hitPadOrbitRadius = 100 * scale;
  const pads: HitBubblePad[] = PLAYER_HEX_AUTHORED_HIT_PADS.map(({ pad }) => pad);

  return (
    <div
      ref={stageRef}
      className={algebraStyles.rtcmHitPadStage}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <RtcmBlankNumberToken size={emptyTokenSize} borderColor="rgba(255,255,255,.42)" background="rgba(255,255,255,.06)" />
      </div>

      {pads.map((pad) => {
        const padStyle = getHitBubblePadStyle(pad, hitPadOrbitRadius, 2);
        const padNumber = getHitPadNumber(pad, 2);

        return (
          <button
            key={pad}
            type="button"
            className={algebraStyles.rtcmHitPadButton}
            onClick={isSongPlaying ? () => onAddHit(pad) : undefined}
            aria-label={`Add hit at pad ${padNumber}`}
            disabled={!isSongPlaying}
            style={{
              position: "absolute",
              width: hitPadDiameter,
              height: hitPadDiameter,
              ...padStyle,
            }}
          >
            <span
              aria-hidden="true"
              className={algebraStyles.rtcmHitPadLabel}
              style={{
                fontSize: Math.max(16, Math.round(24 * scale)),
              }}
            >
              {padNumber}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RtcmHoldToken({
  mechanic,
  isSongPlaying,
  isArmed,
  onStartHold,
  onEndHold,
}: {
  mechanic: Exclude<GameplayMechanic, "hit">;
  isSongPlaying: boolean;
  isArmed: boolean;
  onStartHold: (mechanic: Exclude<GameplayMechanic, "hit">) => void;
  onEndHold: () => void;
}) {
  const [dragArcProgress, setDragArcProgress] = useState(0);
  const [dragArcSide, setDragArcSide] = useState<-1 | 1>(-1);
  const [isDraggingToken, setIsDraggingToken] = useState(false);
  const [spinHandleAngle, setSpinHandleAngle] = useState(-90);
  const [isDraggingSpinHandle, setIsDraggingSpinHandle] = useState(false);
  const pointerStateRef = useRef<{
    pointerId: number;
    startedHold: boolean;
  } | null>(null);
  const spinHandleStateRef = useRef<{
    pointerId: number;
    startedHold: boolean;
  } | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const keyboardHoldRef = useRef(false);
  const endHoldRef = useRef(onEndHold);
  useEffect(() => { endHoldRef.current = onEndHold; }, [onEndHold]);
  const settleGesture = useCallback(() => {
    const started = pointerStateRef.current?.startedHold || spinHandleStateRef.current?.startedHold || keyboardHoldRef.current;
    pointerStateRef.current = null;
    spinHandleStateRef.current = null;
    keyboardHoldRef.current = false;
    setIsDraggingToken(false);
    setIsDraggingSpinHandle(false);
    setDragArcProgress(0);
    setDragArcSide(-1);
    setSpinHandleAngle(-90);
    if (started) endHoldRef.current();
  }, []);
  useEffect(() => {
    const onVisibilityChange = () => { if (document.hidden) settleGesture(); };
    window.addEventListener("blur", settleGesture);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", settleGesture);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const started = pointerStateRef.current?.startedHold || spinHandleStateRef.current?.startedHold || keyboardHoldRef.current;
      pointerStateRef.current = null;
      spinHandleStateRef.current = null;
      keyboardHoldRef.current = false;
      if (started) endHoldRef.current();
    };
  }, [settleGesture]);
  const spinRingDiameter = 190;
  const spinHandleDiameter = Math.max(34, Math.round(68 * 0.75));
  const spinRingRadius = spinRingDiameter / 2;
  const dragArcCenterX = 130;
  const dragArcCenterY = 130;
  const dragArcRadiusX = 72;
  const dragArcRadiusY = 72;

  const tokenBasePosition = {
    left: 130,
    top: 130,
  };

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function dragPositionFromClientPosition(clientX: number, clientY: number) {
    const surface = surfaceRef.current;

    if (!surface) {
      return {
        progress: dragArcProgress,
        side: dragArcSide,
      };
    }

    const rect = surface.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const normalizedX = (localX - dragArcCenterX) / dragArcRadiusX;
    const normalizedY = (localY - dragArcCenterY) / dragArcRadiusY;
    const theta = Math.atan2(Math.abs(normalizedY), normalizedX);
    const side: -1 | 1 = normalizedY > 0 ? 1 : -1;

    return {
      progress: clamp(1 - theta / Math.PI, 0, 1),
      side,
    };
  }

  function handleTokenPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (mechanic === "spin" || !isSongPlaying || !event.isPrimary || event.button !== 0 || pointerStateRef.current || spinHandleStateRef.current || keyboardHoldRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startedHold = isSongPlaying;

    if (mechanic === "drag") {
      const nextPosition = dragPositionFromClientPosition(
        event.clientX,
        event.clientY,
      );
      setDragArcProgress(nextPosition.progress);
      setDragArcSide(nextPosition.side);
    }

    pointerStateRef.current = {
      pointerId: event.pointerId,
      startedHold,
    };

    setIsDraggingToken(true);

    if (startedHold) {
      onStartHold(mechanic);
    }
  }

  function handleTokenPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (mechanic === "spin") {
      return;
    }

    const pointerState = pointerStateRef.current;

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    if (mechanic === "drag") {
      const nextPosition = dragPositionFromClientPosition(
        event.clientX,
        event.clientY,
      );
      setDragArcProgress(nextPosition.progress);
      setDragArcSide(nextPosition.side);
    }
  }

  function finishTokenGesture(event: PointerEvent<HTMLButtonElement>) {
    if (mechanic === "spin") {
      return;
    }

    const pointerState = pointerStateRef.current;

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    settleGesture();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function angleFromClientPosition(clientX: number, clientY: number) {
    const surface = surfaceRef.current;

    if (!surface) {
      return spinHandleAngle;
    }

    const rect = surface.getBoundingClientRect();
    const centerX = rect.left + tokenBasePosition.left;
    const centerY = rect.top + tokenBasePosition.top;

    return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
  }

  function handleSpinHandlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!isSongPlaying || !event.isPrimary || event.button !== 0 || pointerStateRef.current || spinHandleStateRef.current || keyboardHoldRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startedHold = isSongPlaying;

    spinHandleStateRef.current = {
      pointerId: event.pointerId,
      startedHold,
    };

    setIsDraggingSpinHandle(true);
    setSpinHandleAngle(angleFromClientPosition(event.clientX, event.clientY));

    if (startedHold) {
      onStartHold("spin");
    }
  }

  function handleSpinHandlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const state = spinHandleStateRef.current;

    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    setSpinHandleAngle(angleFromClientPosition(event.clientX, event.clientY));
  }

  function finishSpinHandleGesture(event: PointerEvent<HTMLButtonElement>) {
    const state = spinHandleStateRef.current;

    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    settleGesture();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const spinHandleX =
    tokenBasePosition.left + spinRingRadius * Math.cos((spinHandleAngle * Math.PI) / 180);
  const spinHandleY =
    tokenBasePosition.top + spinRingRadius * Math.sin((spinHandleAngle * Math.PI) / 180);
  const dragTokenAngle = Math.PI * (1 - dragArcProgress);
  const dragTokenX = dragArcCenterX + dragArcRadiusX * Math.cos(dragTokenAngle);
  const dragTokenY =
    dragArcCenterY + dragArcSide * dragArcRadiusY * Math.sin(dragTokenAngle);

  function startKeyboardGesture(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!isSongPlaying || event.repeat || pointerStateRef.current || spinHandleStateRef.current || keyboardHoldRef.current) return;
    keyboardHoldRef.current = true;
    if (mechanic === "spin") setIsDraggingSpinHandle(true);
    else setIsDraggingToken(true);
    onStartHold(mechanic);
  }

  function endKeyboardGesture(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === " " || event.key === "Enter") && keyboardHoldRef.current) {
      event.preventDefault();
      settleGesture();
    }
  }

  return (
    <div
      ref={surfaceRef}
      className={algebraStyles.rtcmGestureStage}
      data-mechanic={mechanic}
      data-armed={isArmed ? "true" : "false"}
      data-capturing={(isDraggingToken || isDraggingSpinHandle) ? "true" : "false"}
    >
      {mechanic === "spin" ? (
        <span
          aria-hidden="true"
          className={algebraStyles.rtcmSpinGlyph}
        >
          <SpinIcon
            className={algebraStyles.rtcmSpinGlyphIcon}
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={algebraStyles.rtcmDragGhost}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 260 260"
            fill="none"
            preserveAspectRatio="none"
            style={{ display: "block", overflow: "visible" }}
          >
            <path
              d="M 58 130 A 72 72 0 0 1 202 130"
              stroke="rgba(157, 145, 255, 0.2)"
              strokeWidth="42"
              strokeLinecap="round"
              strokeDasharray="1 5"
            />
            <path
              d="M 58 130 A 72 72 0 0 0 202 130"
              stroke="rgba(157, 145, 255, 0.2)"
              strokeWidth="42"
              strokeLinecap="round"
              strokeDasharray="1 5"
            />
            {isDraggingToken ? <path
              d={dragArcSide === -1 ? "M 58 130 A 72 72 0 0 1 202 130" : "M 58 130 A 72 72 0 0 0 202 130"}
              pathLength={1} stroke="#b3f1eb" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="1" strokeDashoffset={1 - dragArcProgress}
            /> : null}
          </svg>
        </span>
      )}

      {mechanic === "spin" ? (
        <span
          aria-hidden="true"
          className={algebraStyles.rtcmSpinTrack}
          style={{ width: spinRingDiameter, height: spinRingDiameter }}
        />
      ) : null}

      {mechanic === "spin" ? (
        <button
          type="button"
          onPointerDown={handleSpinHandlePointerDown}
          onPointerMove={handleSpinHandlePointerMove}
          onPointerUp={finishSpinHandleGesture}
          onPointerCancel={finishSpinHandleGesture}
          onLostPointerCapture={finishSpinHandleGesture}
          onKeyDown={startKeyboardGesture}
          onKeyUp={endKeyboardGesture}
          onBlur={() => { if (keyboardHoldRef.current) settleGesture(); }}
          aria-keyshortcuts="Space Enter"
          disabled={!isSongPlaying}
          className={algebraStyles.rtcmSpinHandle}
          data-capturing={isDraggingSpinHandle ? "true" : "false"}
          style={{
            position: "absolute",
            left: spinHandleX,
            top: spinHandleY,
            width: spinHandleDiameter,
            height: spinHandleDiameter,
            transition: isDraggingSpinHandle ? "none" : undefined,
          }}
          aria-label="Hold to add spin timing"
          title={
            isSongPlaying
              ? "Hold and drag around the ring to create spin timing, then release to end."
              : "Play song to capture timing while dragging this circle around the ring."
          }
        />
      ) : null}

      <button
        type="button"
        onPointerDown={handleTokenPointerDown}
        onPointerMove={handleTokenPointerMove}
        onPointerUp={finishTokenGesture}
        onPointerCancel={finishTokenGesture}
        onLostPointerCapture={finishTokenGesture}
        onKeyDown={startKeyboardGesture}
        onKeyUp={endKeyboardGesture}
        onBlur={() => { if (keyboardHoldRef.current) settleGesture(); }}
        aria-keyshortcuts="Space Enter"
        disabled={!isSongPlaying || mechanic === "spin"}
        aria-hidden={mechanic === "spin" || undefined}
        className={algebraStyles.rtcmGestureToken}
        data-mechanic={mechanic}
        data-armed={isArmed ? "true" : "false"}
        data-capturing={isDraggingToken ? "true" : "false"}
        style={{
          position: "absolute",
          left: mechanic === "drag" ? dragTokenX : tokenBasePosition.left,
          top: mechanic === "drag" ? dragTokenY : tokenBasePosition.top,
          transition:
            mechanic === "drag"
              ? isDraggingToken
                ? "none"
                : "left 180ms ease-out, top 180ms ease-out"
              : isDraggingToken
                ? "none"
                : undefined,
        }}
        aria-label={`Hold to add ${mechanic} timing`}
        title={
          isSongPlaying
            ? `Hold to create ${mechanic} timing, then release to end.`
            : "Play song to capture timing while dragging this token."
        }
      >
        <RtcmBlankNumberToken
          size={mechanic === "drag" ? 112 : 72}
          borderColor={mechanic === "spin" ? "#FF8A8A99" : "#D2A9FF99"}
          background={mechanic === "spin" ? "#4A1D22" : "#2D1A47"}
        />
      </button>
    </div>
  );
}

export function LiveEncounterRecorder({
  onAddHit,
  onStartHold,
  onEndHold,
  onCreateEvent,
  onDeleteEvent,
  onClear,
  isSongPlaying,
  currentSongSeconds,
  pendingRangeMechanic,
  eventRangeStartTick,
  canDeleteEvent,
  draftedActionCount,
  inRangeDraftCount,
  outOfRangeDraftCount,
  equationLabel = "",
  chartCueTimes = [],
}: {
  onAddHit: (pad: HitBubblePad) => void;
  onStartHold: (tool: Exclude<GameplayMechanic, "hit">) => void;
  onEndHold: () => void;
  onCreateEvent: () => void;
  onDeleteEvent: () => void;
  onClear: () => void;
  isSongPlaying: boolean;
  currentSongSeconds: number;
  pendingRangeMechanic: "spin" | "drag" | null;
  eventRangeStartTick: number | null;
  canDeleteEvent: boolean;
  draftedActionCount: number;
  inRangeDraftCount: number;
  outOfRangeDraftCount: number;
  equationLabel?: string;
  chartCueTimes?: readonly number[];
}) {
  const [selectedTool, setSelectedTool] = useState<GameplayMechanic>("hit");
  const isEncounterOpen = eventRangeStartTick !== null;
  const canRecord = isSongPlaying && isEncounterOpen;
  const presentation = getRecorderPresentationState({ playing: isSongPlaying, rangeOpen: isEncounterOpen, pending: pendingRangeMechanic, drafts: draftedActionCount });
  const capturePrompt = canRecord ? "CAPTURE READY" : isSongPlaying ? "OPEN RANGE" : isEncounterOpen ? "PLAY SONG" : "OPEN RANGE + PLAY";
  const nearestCueIndex = findNearestChartCueIndex(chartCueTimes, currentSongSeconds);
  const nearestCue = nearestCueIndex < 0 ? null : chartCueTimes[nearestCueIndex];

  return (
    <section className={algebraStyles.rtcmModePanel} data-ur-editor="live" data-editor-state={presentation.phase} aria-label="Real-time chart maker" data-encounter-open={isEncounterOpen ? "true" : "false"}>
      <div className={algebraStyles.rtcmModeHeader}>
        <div className={algebraStyles.rtcmModeIdentity}>
          <strong>Capture the move on the beat</strong>
          <span>Play the song, open an encounter, then record each gesture.</span>
          <div className={algebraStyles.rtcmContextStrip}>
            <span><b>Selected equation</b> {equationLabel || "Assign an equation before Check & play."}</span>
            <span aria-live="off">{nearestCue === null ? "No playable chart cues available" : `Chart cue ${nearestCueIndex + 1}/${chartCueTimes.length} · ${formatSongTime(nearestCue, true)} · playhead ${Math.round(Math.abs(currentSongSeconds - nearestCue) * 1000)}ms ${currentSongSeconds < nearestCue ? "before" : "after"}`}</span>
          </div>
        </div>
        <div className={algebraStyles.rtcmModeActions}>
          <button
            type="button"
            className={`${algebraStyles.recordEncounterButton} ${algebraStyles.rtcmRecordButton}`}
            aria-pressed={isEncounterOpen}
            data-recording={isEncounterOpen ? "true" : "false"}
            title={eventRangeStartTick === null ? "Start capturing moves in a song range" : "Finish and save the recorded encounter"}
            onClick={onCreateEvent}
          >
            {eventRangeStartTick === null ? "Record encounter" : "Save encounter"}
          </button>
          <button type="button" className={algebraStyles.rtcmSecondaryButton} onClick={onDeleteEvent} disabled={!canDeleteEvent}>
            Delete event
          </button>
          <button type="button" className={algebraStyles.rtcmClearButton} onClick={onClear}>
            Clear draft
          </button>
        </div>
      </div>

      {isEncounterOpen ? (
        <div className={algebraStyles.rtcmCaptureReadout} aria-label="Encounter capture range" aria-live="off">
          <div className={algebraStyles.rtcmCaptureMeta}>
            <span>CAPTURE WINDOW</span>
            <span>PLAYHEAD {formatSongTime(currentSongSeconds, true)}</span>
          </div>
          <div className={algebraStyles.rtcmCaptureRange}>
            <span>{formatSongTime(Math.min(eventRangeStartTick, currentSongSeconds), true)}</span>
            <span aria-hidden="true">→</span>
            <span>{formatSongTime(Math.max(eventRangeStartTick, currentSongSeconds), true)}</span>
          </div>
          <div className={algebraStyles.rtcmCaptureCounts}>
            <span>{inRangeDraftCount} move{inRangeDraftCount === 1 ? "" : "s"} will be included</span>
            {outOfRangeDraftCount > 0 ? <span>{outOfRangeDraftCount} draft{outOfRangeDraftCount === 1 ? "" : "s"} outside this range</span> : null}
          </div>
        </div>
      ) : null}

      <div className={algebraStyles.rtcmToolRail} role="group" aria-label="Choose recorder tool">
        {gameplayMechanics.map((mechanic) => (
          <button
            key={mechanic}
            type="button"
            className={algebraStyles.rtcmToolButton}
            data-mechanic={mechanic}
            aria-pressed={selectedTool === mechanic}
            onClick={() => setSelectedTool(mechanic)}
          >
            <span className={algebraStyles.rtcmToolIcon} aria-hidden="true">
              {mechanic === "hit" ? <TouchAppRoundedIcon fontSize="small" /> : mechanic === "spin" ? <ReplayRoundedIcon fontSize="small" /> : <SwipeRoundedIcon fontSize="small" />}
            </span>
            <span className={algebraStyles.rtcmToolCopy}>
              <strong>{mechanic === "hit" ? "Hit" : mechanic === "spin" ? "Spin" : "Drag"}</strong>
              <small>{mechanic === "hit" ? "Tap a pad" : mechanic === "spin" ? "Hold and turn" : "Pull a term"}</small>
            </span>
          </button>
        ))}
      </div>

      <div
        className={algebraStyles.rtcmCaptureStatus}
        role="status"
        aria-live="polite"
        data-state={presentation.phase}
        data-editor-signal={presentation.phase === "ready" ? "ready" : undefined}
      >
        <span className={algebraStyles.rtcmStatusDot} aria-hidden="true" />
        <span>{presentation.phase === "capturing"
          ? `Recording ${pendingRangeMechanic}. Release to set its end time.`
          : isEncounterOpen
            ? `${inRangeDraftCount} move${inRangeDraftCount === 1 ? "" : "s"} in this range. ${isSongPlaying ? "Use the selected gesture or save the encounter." : "Play the song to capture moves."}`
            : draftedActionCount > 0
              ? `${draftedActionCount} unsaved move${draftedActionCount === 1 ? "" : "s"} remain. Start an encounter to place them in a song range.`
              : "Start an encounter, play the song, then capture each gesture."}
        </span>
        <span className={algebraStyles.rtcmCaptureReady} data-editor-phase={presentation.phase}>{presentation.label}</span>
      </div>

      <div className={algebraStyles.rtcmPreviewRegion}>
        <div className={algebraStyles.rtcmPreviewCard} data-mechanic="hit" style={{ display: selectedTool === "hit" ? "grid" : "none" }} aria-hidden={selectedTool !== "hit"}>
          <div className={algebraStyles.rtcmPreviewHeading}>
            <span className={algebraStyles.rtcmPreviewGlyph} aria-hidden="true"><TouchAppRoundedIcon fontSize="small" /></span>
            <div><strong>Choose a hit pad</strong><span>Tap the pad the learner should hit.</span></div>
            <span className={algebraStyles.rtcmPreviewState} data-ready={canRecord ? "true" : "false"}>{canRecord ? "CAPTURE READY" : capturePrompt}</span>
          </div>
          {selectedTool === "hit" ? <RtcmHitPadToken onAddHit={onAddHit} isSongPlaying={canRecord} /> : null}
          <p className={algebraStyles.rtcmPreviewHint}>Each tap records a chart-timed Hit at the current playhead.</p>
        </div>

        <div className={algebraStyles.rtcmPreviewCard} data-mechanic="spin" style={{ display: selectedTool === "spin" ? "grid" : "none" }} aria-hidden={selectedTool !== "spin"}>
          <div className={algebraStyles.rtcmPreviewHeading}>
            <span className={algebraStyles.rtcmPreviewGlyph} aria-hidden="true"><ReplayRoundedIcon fontSize="small" /></span>
            <div><strong>Trace the spin</strong><span>Hold the handle and follow the ring.</span></div>
            <span className={algebraStyles.rtcmPreviewState} data-ready={pendingRangeMechanic === "spin" ? "true" : "false"}>{pendingRangeMechanic === "spin" ? "RELEASE TO SET END" : canRecord ? "READY TO SPIN" : capturePrompt}</span>
          </div>
          {selectedTool === "spin" ? <RtcmHoldToken key={`spin-${canRecord}`} mechanic="spin" isSongPlaying={canRecord} isArmed={canRecord && pendingRangeMechanic === "spin"} onStartHold={onStartHold} onEndHold={onEndHold} /> : null}
          <p className={algebraStyles.rtcmPreviewHint}>Hold for the full spin duration; release to set its end time.</p>
        </div>

        <div className={algebraStyles.rtcmPreviewCard} data-mechanic="drag" style={{ display: selectedTool === "drag" ? "grid" : "none" }} aria-hidden={selectedTool !== "drag"}>
          <div className={algebraStyles.rtcmPreviewHeading}>
            <span className={algebraStyles.rtcmPreviewGlyph} aria-hidden="true"><SwipeRoundedIcon fontSize="small" /></span>
            <div><strong>Pull the term across</strong><span>Follow the curved path, then release.</span></div>
            <span className={algebraStyles.rtcmPreviewState} data-ready={pendingRangeMechanic === "drag" ? "true" : "false"}>{pendingRangeMechanic === "drag" ? "RELEASE TO SET END" : canRecord ? "READY TO DRAG" : capturePrompt}</span>
          </div>
          {selectedTool === "drag" ? <RtcmHoldToken key={`drag-${canRecord}`} mechanic="drag" isSongPlaying={canRecord} isArmed={canRecord && pendingRangeMechanic === "drag"} onStartHold={onStartHold} onEndHold={onEndHold} /> : null}
          <p className={algebraStyles.rtcmPreviewHint}>Keep the pointer down for the full drag duration to record its path in the encounter.</p>
        </div>
      </div>
    </section>
  );
}

