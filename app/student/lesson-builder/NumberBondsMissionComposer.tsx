"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { NUMBER_BONDS_MAX_WHOLE, NUMBER_BONDS_MIN_WHOLE } from "@/lib/number-bonds-authoring";
import type { NumberBondJourneyView } from "@/lib/editor/number-bond-journey-view";
import { getNumberBondEditorAction } from "@/lib/editor/number-bond-editor-action";
import { getBondPresentationState } from "@/lib/editor/presentation-state";
import styles from "./NumberBondsMissionComposer.module.css";

type OrbitNote = { id: string; seconds: number };
const QUICK_TARGETS = [5, 7, 8, 10, 12, 15, 20];

function cueTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "Timing unavailable";
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  return `${Math.floor(centiseconds / 6000)}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

function UnitGroup({ count, tone, label, filled = true }: { count: number; tone: "whole" | "partA" | "partB"; label: string; filled?: boolean }) {
  const tenGroups = Math.floor(count / 10);
  const looseCount = count % 10;
  const units = (length: number) => Array.from({ length }, (_, index) => (
    <span className={`${styles.modelUnit} ${styles[`modelUnit_${tone}`]} ${filled ? "" : styles.modelUnit_empty}`} key={index} aria-hidden="true" />
  ));

  return (
    <div className={styles.unitGroup} role="img" aria-label={label}>
      {Array.from({ length: tenGroups }, (_, index) => (
        <span className={styles.tenFrame} key={`ten-${index}`} aria-hidden="true">{units(10)}</span>
      ))}
      {looseCount ? (
        <span
          className={styles.looseUnits}
          style={{ "--unit-columns": Math.min(5, looseCount) } as CSSProperties}
          aria-hidden="true"
        >
          {units(looseCount)}
        </span>
      ) : null}
    </div>
  );
}

function PartWholeModel({ whole, partA, partB }: { whole: number; partA: number; partB: number }) {
  return (
    <div className={styles.pictorialModel} aria-label={`${whole} equals ${partA} plus ${partB}; every gem is one unit`}>
      <div className={styles.modelWhole}>
        <span>Whole · {whole}</span>
        <UnitGroup count={whole} tone="whole" label={`${whole} single-unit gems in the whole`} />
      </div>
      <div className={styles.modelConnector} aria-hidden="true"><span /></div>
      <div className={styles.modelParts}>
        <div>
          <span>Part A · {partA}</span>
          <UnitGroup count={partA} tone="partA" label={`${partA} single-unit places in part A`} filled={false} />
        </div>
        <strong aria-hidden="true">+</strong>
        <div>
          <span>Part B · {partB}</span>
          <UnitGroup count={partB} tone="partB" label={`${partB} single-unit places in part B`} filled={false} />
        </div>
      </div>
      <p>{whole} = {partA} + {partB}</p>
    </div>
  );
}

export function NumberBondsMissionComposer({
  whole,
  partA,
  partB,
  songTitle,
  songDifficulty,
  songCapacity,
  isSongLoaded,
  loadError,
  notes,
  authoredNoteCount,
  hasAuthoredSequence,
  isDemoMode = false,
  publishedLaunchPhase = "idle",
  publishedLessonUnavailable = false,
  selectedNoteId,
  selectedHitEditor,
  selectedEncounterId,
  journeys = [],
  onSelectJourneyStage,
  stopAtSeconds,
  songDurationSeconds,
  isReady,
  isPreparing,
  status,
  onWholeChange,
  onPartAChange,
  onShuffle,
  onBuildNotes,
  onPlay,
  onSelectNote,
}: {
  whole: number;
  partA: number;
  partB: number;
  songTitle: string;
  songDifficulty: string;
  songCapacity: number;
  isSongLoaded: boolean;
  loadError?: string | null;
  notes: OrbitNote[];
  authoredNoteCount: number;
  hasAuthoredSequence: boolean;
  isDemoMode?: boolean;
  publishedLaunchPhase?: "idle" | "checking" | "preparing";
  publishedLessonUnavailable?: boolean;
  selectedNoteId?: string | null;
  selectedHitEditor?: ReactNode;
  selectedEncounterId?: string | null;
  journeys?: readonly NumberBondJourneyView[];
  onSelectJourneyStage?: (id: string, seconds: number) => void;
  stopAtSeconds?: number;
  songDurationSeconds: number;
  isReady: boolean;
  isPreparing: boolean;
  status: string;
  onWholeChange: (whole: number) => void;
  onPartAChange: (partA: number) => void;
  onShuffle: () => void;
  onBuildNotes: () => void;
  onPlay: () => void;
  onSelectNote: (index: number) => void;
}) {
  const [wholeDraft, setWholeDraft] = useState({ whole, songCapacity, text: String(whole) });
  const [cueView, setCueView] = useState<"sequence" | "orbit">("sequence");
  const selectedHitEditorRef = useRef<HTMLElement | null>(null);
  const previousSelectedNoteId = useRef(selectedNoteId);
  const wholeText = wholeDraft.whole === whole && wholeDraft.songCapacity === songCapacity
    ? wholeDraft.text
    : String(whole);

  const maxSelectableWhole = Math.min(NUMBER_BONDS_MAX_WHOLE, songCapacity);
  const maxInputWhole = Math.max(NUMBER_BONDS_MIN_WHOLE, maxSelectableWhole);
  const canChooseNumber = isSongLoaded && maxSelectableWhole >= NUMBER_BONDS_MIN_WHOLE && !isPreparing;
  const canPlaceNotes = whole >= NUMBER_BONDS_MIN_WHOLE && whole <= maxSelectableWhole;
  const primaryAction = getNumberBondEditorAction({ ready: isReady, matchingNotes: authoredNoteCount === whole, hasSequence: hasAuthoredSequence, demo: isDemoMode });
  const presentation = getBondPresentationState({ loaded: isSongLoaded, error: Boolean(loadError), preparing: isPreparing, ready: isReady, built: primaryAction === "review" });
  const stopFitsSong = !stopAtSeconds || !songDurationSeconds || stopAtSeconds <= songDurationSeconds + 0.05;
  const publishedLaunchPending = isDemoMode && publishedLaunchPhase !== "idle";
  const canPlay = isSongLoaded && !loadError && (primaryAction === "published-template"
    ? !publishedLessonUnavailable
    : primaryAction === "review" || (stopFitsSong && (isReady || canPlaceNotes)));
  const selectedNoteIndex = selectedNoteId ? notes.findIndex((note) => note.id === selectedNoteId) : -1;
  const selectedNote = selectedNoteIndex >= 0 ? notes[selectedNoteIndex] : null;
  const selectedJourney = journeys.find(journey =>
    [journey.sourceHitId, journey.spin?.id, journey.drag?.id].some(id => Boolean(id) && id === (selectedEncounterId ?? selectedNoteId)));

  useEffect(() => {
    if (previousSelectedNoteId.current === selectedNoteId) return;
    previousSelectedNoteId.current = selectedNoteId;
    if (!selectedNoteId || !selectedHitEditorRef.current) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    selectedHitEditorRef.current.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, [selectedNoteId]);
  // Keep every cue's 44px pointer target separate, including the inner ring.
  const usesTwoOrbitRings = whole >= 13;
  const outerOrbitCount = usesTwoOrbitRings ? Math.ceil(whole / 2) : whole;
  const lastNoteSeconds = notes.length ? Math.max(...notes.map((note) => note.seconds)) : null;
  const formattedStop = stopAtSeconds === undefined ? "After notes are placed" : `${Math.floor(stopAtSeconds / 60)}:${String(Math.floor(stopAtSeconds % 60)).padStart(2, "0")}`;
  const difficultyLabel = songDifficulty.replace("Single", "");
  const capacityMessage = !isSongLoaded
    ? "Loading this song’s playable notes…"
    : songCapacity < NUMBER_BONDS_MIN_WHOLE
      ? `This ${difficultyLabel} chart cannot fit ${NUMBER_BONDS_MIN_WHOLE} complete gem journeys. Choose a longer or more open song chart.`
      : whole > maxSelectableWhole
        ? `This ${difficultyLabel} chart supports up to ${maxSelectableWhole} complete gem journeys. Choose a smaller target or a song with more room between cues.`
        : `Up to ${maxSelectableWhole} complete gem journeys fit this ${difficultyLabel} chart. The game limit is ${NUMBER_BONDS_MAX_WHOLE}.`;

  if (!isSongLoaded) {
    return (
      <section className={styles.composer} data-ur-editor="number-bonds" data-editor-state={presentation.phase} aria-label="Number Bonds mission composer" aria-busy={!loadError}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>NUMBER BONDS · {songTitle}</span>
          <h1>Build a bond. Play the song.</h1>
        </div>
        <p className={styles.status} data-editor-signal={loadError ? "error" : undefined} role={loadError ? "alert" : "status"}>
          {loadError || status || `Loading ${songTitle}’s chart and playable notes…`}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.composer} data-ur-editor="number-bonds" data-editor-state={presentation.phase} aria-busy={isPreparing} aria-label="Number Bonds mission composer">
      <div className={styles.intro}>
        <span className={styles.eyebrow}>NUMBER BONDS · {songTitle}</span>
        <h1>Build a bond. Play the song.</h1>
        <p>Choose a whole from 2 to {NUMBER_BONDS_MAX_WHOLE} and split it into two parts. Hits use verified cues across this song; each gem then spins and drags on beat. Select a placed Hit to change its pad or fine-tune its timing.</p>
        <span className={styles.phase} data-editor-phase={presentation.phase}>{presentation.label}</span>
      </div>
      {authoredNoteCount === whole && !hasAuthoredSequence ? (
        <p className={styles.sequenceHint} role="note">This saved revision has chart-timed Hits only. Build gems from the chart to add a Spin and Drag to every unit.</p>
      ) : null}

      <div className={styles.cueWorkspace}>
        <div className={styles.bondSummary} role="img" aria-label={`Whole ${whole} is made from part A ${partA} and part B ${partB}`}>
          <div><span>Part–whole relationship</span><strong>{partA} + {partB} = {whole}</strong></div>
          <div className={styles.bondBar} aria-hidden="true">
            <span style={{ transform: `scaleX(${partA / whole})` }} />
            <span style={{ transform: `scaleX(${partB / whole})` }} />
          </div>
          <div className={styles.bondLabels} aria-hidden="true"><span>Part A · {partA}</span><span>Part B · {partB}</span></div>
        </div>
        <div className={styles.cueToolbar}>
          <h2>Gem cues</h2>
          <div role="group" aria-label="Gem cue view">
            <button type="button" aria-pressed={cueView === "sequence"} onClick={() => setCueView("sequence")}>Sequence</button>
            <button type="button" aria-pressed={cueView === "orbit"} onClick={() => setCueView("orbit")}>Orbit</button>
          </div>
        </div>
        {cueView === "sequence" ? (
          <ol className={styles.cueList} aria-label="Chart-timed gem sequence">
            {Array.from({ length: whole }, (_, index) => {
              const note = notes[index];
              const isAuthored = Boolean(note && index < authoredNoteCount);
              const isSelected = Boolean(isAuthored && note?.id === selectedNoteId);
              const journey = note ? journeys.find(item => item.sourceHitId === note.id) : undefined;
              return (
                <li key={note?.id ?? `pending-${index}`}>
                  <button type="button" disabled={!isAuthored} aria-pressed={isAuthored ? isSelected : undefined}
                    data-selected={isSelected || undefined} data-built={isAuthored || undefined}
                    onClick={() => onSelectNote(index)}
                    aria-label={`Gem ${index + 1}${note ? ` at ${cueTime(note.seconds)}` : ", awaiting timing"}${isAuthored ? ", select to edit Hit" : ", build gems to use this cue"}`}>
                    <span className={styles.cueNumber}>{index + 1}</span>
                    <span className={styles.cueTime}>{note ? cueTime(note.seconds) : "Awaiting chart"}</span>
                    <span className={styles.cueState}>{isAuthored ? hasAuthoredSequence ? journey && !journey.issues.length ? "Hit · Spin · Drag" : "Check links" : "Hit only" : note ? "Suggested" : "Pending"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
      <div className={`${styles.orbit} ${usesTwoOrbitRings ? styles.orbitDense : ""}`} role="group" aria-label={`Make ${whole}: ${whole} equals ${partA} plus ${partB}; ${whole} chart-timed gem journeys`}
        style={{ "--bond-progress": `${Math.min(100, 100 * authoredNoteCount / whole)}%` } as CSSProperties}>
        <div className={styles.orbitRing} aria-hidden="true" />
        {usesTwoOrbitRings ? <div className={styles.orbitRingInner} aria-hidden="true" /> : null}
        <div className={styles.orbitCore}>
          <span>MAKE</span>
          <strong>{whole}</strong>
          <span className={styles.equation}>{whole} = {partA} + {partB}</span>
        </div>
        {Array.from({ length: whole }, (_, index) => {
          const usesInnerRing = usesTwoOrbitRings && index >= outerOrbitCount;
          const ringIndex = usesInnerRing ? index - outerOrbitCount : index;
          const ringCount = usesInnerRing ? whole - outerOrbitCount : outerOrbitCount;
          const orbitRadius = usesInnerRing ? 27 : usesTwoOrbitRings ? 43.5 : 39;
          const angle = -Math.PI / 2 + 2 * Math.PI * (ringIndex + (usesInnerRing ? 0.5 : 0)) / ringCount;
          const note = notes[index];
          const isAuthored = Boolean(note && index < authoredNoteCount);
          const isNextSuggested = Boolean(note && !isAuthored && index === authoredNoteCount);
          const isSelected = Boolean(isAuthored && selectedNoteId && note?.id === selectedNoteId);
          return (
            <button
              className={`${styles.note} ${isAuthored ? styles.notePlaced : note ? styles.noteSuggested : styles.noteEmpty} ${isNextSuggested ? styles.noteNext : ""} ${isSelected ? styles.noteSelected : ""}`}
              key={index}
              type="button"
              style={{ left: `${50 + Math.cos(angle) * orbitRadius}%`, top: `${50 + Math.sin(angle) * orbitRadius}%`, animationDelay: `${(index % 5) * -0.45}s` }}
              disabled={!isAuthored}
              onClick={() => onSelectNote(index)}
              aria-pressed={isAuthored ? isSelected : undefined}
              aria-label={note ? `${isAuthored ? "Placed" : "Suggested"} note ${index + 1} at ${note.seconds.toFixed(1)} seconds${isSelected ? ", selected for editing" : ""}` : `Note ${index + 1} awaits song timing`}
              title={note ? `${note.seconds.toFixed(1)}s · select to edit this Hit` : "Timing will come from the song"}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
        )}
        <p className={styles.cueHelp}>Select a built gem to edit its Hit pad and song timing. Suggested cues become editable after building.</p>
      </div>

      <div className={styles.controls}>
        <details className={styles.learningPanel}>
          <summary>
            <span>How the mission plays</span>
            <strong>{whole} = {partA} + {partB}</strong>
          </summary>
          <div className={styles.learningContent}>
            <div className={styles.playFlow} aria-label="How this lesson plays">
              <span><b>01</b> Catch the gem</span>
              <span><b>02</b> Tap the charted pad</span>
              <span><b>03</b> Spin the gem</span>
              <span><b>04</b> Drag it to a part</span>
            </div>
            <PartWholeModel key={`${whole}-${partA}-${partB}`} whole={whole} partA={partA} partB={partB} />
          </div>
        </details>
        <div className={styles.targetPanel}>
          <div className={styles.targetHeading}>
            <strong>Choose a target</strong>
            <span>2–{NUMBER_BONDS_MAX_WHOLE}</span>
          </div>
          <div className={styles.targetRow}>
            <button type="button" aria-label="Decrease target" disabled={!canChooseNumber || whole <= NUMBER_BONDS_MIN_WHOLE} onClick={() => onWholeChange(whole - 1)}>−</button>
            <label>
              <span>Whole number</span>
              <input type="number" min={NUMBER_BONDS_MIN_WHOLE} max={maxInputWhole} step={1} value={wholeText} disabled={!canChooseNumber}
                aria-describedby="number-bonds-capacity"
              onChange={(event) => {
                const nextText = event.currentTarget.value;
                setWholeDraft({ whole, songCapacity, text: nextText });
                const next = Number(nextText);
                if (nextText && Number.isInteger(next) && next >= NUMBER_BONDS_MIN_WHOLE && next <= maxSelectableWhole && next !== whole) {
                  onWholeChange(next);
                }
              }}
              onBlur={() => setWholeDraft({ whole, songCapacity, text: String(whole) })}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
            </label>
            <button type="button" aria-label="Increase target" disabled={!canChooseNumber || whole >= maxSelectableWhole} onClick={() => onWholeChange(whole + 1)}>+</button>
            <button className={styles.shuffle} type="button" disabled={!canChooseNumber || maxSelectableWhole < 3} onClick={onShuffle}>Shuffle</button>
          </div>
          <fieldset className={styles.splitEditor} disabled={!canChooseNumber} aria-describedby="number-bonds-split-help">
            <legend>Choose the two parts</legend>
            <label>
              <span>Part A</span>
              <input
                type="number"
                min={1}
                max={whole - 1}
                step={1}
                value={partA}
                onChange={(event) => {
                  const next = Number(event.currentTarget.value);
                  if (Number.isInteger(next) && next > 0 && next < whole && next !== partA) onPartAChange(next);
                }}
              />
            </label>
            <span aria-hidden="true">+</span>
            <label>
              <span>Part B</span>
              <input
                type="number"
                min={1}
                max={whole - 1}
                step={1}
                value={partB}
                onChange={(event) => {
                  const next = Number(event.currentTarget.value);
                  const nextPartA = whole - next;
                  if (Number.isInteger(next) && next > 0 && next < whole && nextPartA !== partA) onPartAChange(nextPartA);
                }}
              />
            </label>
            <strong>= {whole}</strong>
          </fieldset>
          <p className={styles.splitHelp} id="number-bonds-split-help">Each part must be at least 1. Changing a part keeps the same {whole} chart hits and their Spin → Drag timings.</p>
          <div className={styles.quickTargets} role="group" aria-label="Common number bond targets">
            {QUICK_TARGETS.map((target) => {
              const available = canChooseNumber && target <= maxSelectableWhole;
              return (
                <button
                  key={target}
                  type="button"
                  className={whole === target ? styles.quickTargetActive : undefined}
                  aria-label={`Make ${target}`}
                  aria-pressed={whole === target}
                  title={available ? `Build make ${target}` : `This song needs room for ${target} complete gem journeys`}
                  disabled={!available}
                  onClick={() => onWholeChange(target)}
                >
                  {target}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.progress}>
          <strong>{authoredNoteCount} of {whole} {hasAuthoredSequence ? "gem journeys built" : "chart Hits placed"}</strong>
          <progress aria-label={hasAuthoredSequence ? "Number of complete gem journeys built" : "Number of chart Hits placed"} max={whole} value={Math.min(authoredNoteCount, whole)} />
          <span id="number-bonds-capacity">{capacityMessage}</span>
        </div>
        <div id="number-bonds-stop-guidance" className={styles.stopCard} role="status">
          <div><span>Lesson ends</span><strong>{formattedStop}</strong></div>
          <p>{!stopFitsSong
            ? "The final gem needs more song time. Move the last note earlier or choose a longer song."
              : lastNoteSeconds === null
              ? "The end point is set automatically after the final gem."
              : hasAuthoredSequence
                ? `Set automatically after the final chart Hit at ${lastNoteSeconds.toFixed(1)}s, with time for its Spin, Drag and finish.`
                : `This saved lesson ends after its final chart Hit at ${lastNoteSeconds.toFixed(1)}s.`}</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" disabled={!isSongLoaded || !canPlaceNotes || isPreparing} onClick={onBuildNotes}>
            {authoredNoteCount ? "Rebuild gems from chart" : "Build gems from chart"}
          </button>
          <button
            className={styles.primary}
            type="button"
            aria-describedby={isDemoMode ? "number-bonds-published-play-guidance" : "number-bonds-stop-guidance"}
            disabled={!canPlay || isPreparing || publishedLaunchPending}
            onClick={onPlay}
          >
            {isDemoMode
              ? publishedLaunchPhase === "checking"
                ? "Checking lesson…"
                : publishedLaunchPhase === "preparing" || isPreparing
                  ? "Preparing lesson…"
                  : publishedLessonUnavailable
                    ? "Published lesson unavailable"
                    : "Play published lesson"
              : isPreparing
              ? "Preparing mission…"
              : !isSongLoaded
                ? "Loading song chart…"
                : primaryAction === "review"
                  ? "Check mission"
                : !stopFitsSong
                  ? "Move final note earlier"
                  : songCapacity < 2 && !isReady
                    ? "Choose another song"
                    : isReady
                      ? hasAuthoredSequence ? "Play mission" : "Play saved lesson"
                      : "Build gems & play"}
          </button>
        </div>
        {isDemoMode ? (
          <p id="number-bonds-published-play-guidance" className={styles.status}>
            Your edits are saved on this device before play. The published lesson plays without these edits.
          </p>
        ) : null}
        {status ? <p className={styles.status} role="status">{status}</p> : null}
      </div>
      {selectedHitEditor ? (
        <section ref={selectedHitEditorRef} className={styles.selectedHitEditor} aria-label="Selected Number Bonds action editor">
          <div className={styles.selectedHitSummary}>
            <span className={styles.eyebrow}>EDITING SELECTED GEM</span>
            <strong>{selectedJourney ? `Gem ${selectedJourney.unitIndex + 1} · Part ${selectedJourney.destination.part === "part-a" ? "A" : "B"}, socket ${selectedJourney.destination.slotIndex + 1}` : selectedNote ? `Gem ${selectedNoteIndex + 1} · ${selectedNote.seconds.toFixed(1)}s` : "Selected gem action"}</strong>
            <p>{selectedJourney ? "Check this action against the song. The linked stages below belong to this same gem." : "Choose this gem’s player pad and check its timing against the song chart."}</p>
          </div>
          {selectedJourney ? (
            <nav className={styles.journeyStages} aria-label="Selected gem journey">
              {(["hit", "spin", "drag"] as const).map(mechanic => {
                const stage = selectedJourney[mechanic];
                return <button key={mechanic} type="button" data-journey-stage={mechanic} disabled={!stage || !onSelectJourneyStage}
                  aria-pressed={Boolean(stage && stage.id === (selectedEncounterId ?? selectedNoteId))}
                  onClick={() => { if (stage) onSelectJourneyStage?.(stage.id, stage.startSeconds); }}>
                  <strong>{mechanic === "hit" ? "Hit" : mechanic === "spin" ? "Spin" : "Drag"}</strong>
                  <span>{stage ? mechanic === "hit" ? cueTime(stage.startSeconds) : `${cueTime(stage.startSeconds)}–${cueTime(stage.endSeconds)}` : "Link or timing unavailable"}</span>
                </button>;
              })}
            </nav>
          ) : null}
          {selectedJourney?.issues.length ? <p className={styles.journeyIssue} role="status">{selectedJourney.issues.join(" ")} Check the lesson’s Ready panel before playing.</p> : null}
          {selectedHitEditor}
        </section>
      ) : null}
    </section>
  );
}
