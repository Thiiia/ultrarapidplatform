"use client";

import { useState, type CSSProperties } from "react";
import { NUMBER_BONDS_MAX_WHOLE, NUMBER_BONDS_MIN_WHOLE } from "@/lib/number-bonds-authoring";
import styles from "./NumberBondsMissionComposer.module.css";

type OrbitNote = { id: string; seconds: number };
const QUICK_TARGETS = [5, 7, 8, 10, 12, 15, 20];

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
  const wholeText = wholeDraft.whole === whole && wholeDraft.songCapacity === songCapacity
    ? wholeDraft.text
    : String(whole);

  const maxSelectableWhole = Math.min(NUMBER_BONDS_MAX_WHOLE, songCapacity);
  const maxInputWhole = Math.max(NUMBER_BONDS_MIN_WHOLE, maxSelectableWhole);
  const canChooseNumber = isSongLoaded && maxSelectableWhole >= NUMBER_BONDS_MIN_WHOLE && !isPreparing;
  const canPlaceNotes = whole >= NUMBER_BONDS_MIN_WHOLE && whole <= maxSelectableWhole;
  const stopFitsSong = !stopAtSeconds || !songDurationSeconds || stopAtSeconds <= songDurationSeconds + 0.05;
  const canPlay = isSongLoaded && stopFitsSong && (isReady || canPlaceNotes);
  // At 17 targets, narrow touch layouts no longer leave 44px between single-ring cues.
  const usesTwoOrbitRings = whole >= 17;
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
      <section className={styles.composer} aria-label="Number Bonds mission composer" aria-busy={!loadError}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>NUMBER BONDS · {songTitle}</span>
          <h1>Build a bond. Play the song.</h1>
        </div>
        <p className={styles.status} role={loadError ? "alert" : "status"}>
          {loadError || status || `Loading ${songTitle}’s chart and playable notes…`}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.composer} aria-label="Number Bonds mission composer">
      <div className={styles.intro}>
        <span className={styles.eyebrow}>NUMBER BONDS · {songTitle}</span>
        <h1>Build a bond. Play the song.</h1>
        <p>Choose a target from 2 to {NUMBER_BONDS_MAX_WHOLE}. Each Hit stays on a playable note from this song’s verified chart; smaller targets sample cues across the track. Spin and Drag land on the chart’s beat grid. Select a placed note to edit its Hit target and player pad in the cue editor; adjust its timing on the Notes track.</p>
      </div>
      {authoredNoteCount === whole && !hasAuthoredSequence ? (
        <p className={styles.sequenceHint} role="note">This saved revision has chart-timed Hits only. Build gems from the chart to add a Spin and Drag to every unit.</p>
      ) : null}

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
          const orbitRadius = usesInnerRing ? 25 : usesTwoOrbitRings ? 40.7 : 39;
          const angle = -Math.PI / 2 + 2 * Math.PI * ringIndex / ringCount;
          const note = notes[index];
          const isAuthored = Boolean(note && index < authoredNoteCount);
          const isNextSuggested = Boolean(note && !isAuthored && index === authoredNoteCount);
          return (
            <button
              className={`${styles.note} ${isAuthored ? styles.notePlaced : note ? styles.noteSuggested : styles.noteEmpty} ${isNextSuggested ? styles.noteNext : ""}`}
              key={index}
              type="button"
              style={{ left: `${50 + Math.cos(angle) * orbitRadius}%`, top: `${50 + Math.sin(angle) * orbitRadius}%`, animationDelay: `${(index % 5) * -0.45}s` }}
              disabled={!isAuthored}
              onClick={() => onSelectNote(index)}
              aria-label={note ? `${isAuthored ? "Placed" : "Suggested"} note ${index + 1} at ${note.seconds.toFixed(1)} seconds` : `Note ${index + 1} awaits song timing`}
              title={note ? `${note.seconds.toFixed(1)}s · select on timeline` : "Timing will come from the song"}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className={styles.controls}>
        <div className={styles.playFlow} aria-label="How this lesson plays">
          <span><b>01</b> Catch the gem</span>
          <span><b>02</b> Tap the charted pad</span>
          <span><b>03</b> Spin the gem</span>
          <span><b>04</b> Drag it to a part</span>
        </div>
        <PartWholeModel key={`${whole}-${partA}-${partB}`} whole={whole} partA={partA} partB={partB} />
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
                  className={whole === target ? styles.quickTargetActive : styles.quickTarget}
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
            aria-describedby="number-bonds-stop-guidance"
            disabled={!canPlay || isPreparing}
            onClick={onPlay}
          >
            {isPreparing
              ? "Preparing mission…"
              : !isSongLoaded
                ? "Loading song chart…"
                : !stopFitsSong
                  ? "Move final note earlier"
                  : songCapacity < 2 && !isReady
                    ? "Choose another song"
                    : isReady
                      ? hasAuthoredSequence ? "Play mission" : "Play saved lesson"
                      : "Build gems & play"}
          </button>
        </div>
        {status ? <p className={styles.status} role="status">{status}</p> : null}
      </div>
    </section>
  );
}
