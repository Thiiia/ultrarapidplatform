"use client";

import { useState } from "react";
import { NUMBER_BONDS_MAX_WHOLE, NUMBER_BONDS_MIN_WHOLE } from "@/lib/number-bonds-authoring";
import styles from "./NumberBondsMissionComposer.module.css";

type OrbitNote = { id: string; seconds: number };
const QUICK_TARGETS = [5, 7, 8, 10, 12, 15, 20];

export function NumberBondsMissionComposer({
  whole,
  partA,
  partB,
  songTitle,
  songDifficulty,
  songCapacity,
  isSongLoaded,
  notes,
  authoredNoteCount,
  isReady,
  isPreparing,
  status,
  onWholeChange,
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
  notes: OrbitNote[];
  authoredNoteCount: number;
  isReady: boolean;
  isPreparing: boolean;
  status: string;
  onWholeChange: (whole: number) => void;
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
  const canPlay = isSongLoaded && (isReady || canPlaceNotes);
  const difficultyLabel = songDifficulty.replace("Single", "");
  const capacityMessage = !isSongLoaded
    ? "Loading this song’s playable notes…"
    : songCapacity < NUMBER_BONDS_MIN_WHOLE
      ? `This ${difficultyLabel} chart has too few playable notes. Choose a song chart with at least ${NUMBER_BONDS_MIN_WHOLE}.`
      : whole > maxSelectableWhole
        ? `This ${difficultyLabel} chart supports up to ${maxSelectableWhole}. Choose a smaller target or a song with more spaced notes.`
        : `Up to ${maxSelectableWhole} spaced cues on this ${difficultyLabel} chart. The game limit is ${NUMBER_BONDS_MAX_WHOLE}.`;

  return (
    <section className={styles.composer} aria-label="Number Bonds mission composer">
      <div className={styles.intro}>
        <span className={styles.eyebrow}>NUMBER BONDS · {songTitle}</span>
        <h1>Build a bond. Play the song.</h1>
        <p>Choose any target from 2 to {NUMBER_BONDS_MAX_WHOLE}. Each orbiting note becomes one gem; the selected song and chart determine how many can fit.</p>
      </div>

      <div className={styles.orbit} role="group" aria-label={`Make ${whole}: ${partA} plus ${partB} equals ${whole}; ${whole} song notes`}>
        <div className={styles.orbitRing} aria-hidden="true" />
        <div className={styles.orbitCore}>
          <span>MAKE</span>
          <strong>{whole}</strong>
          <span className={styles.equation}>{partA} + {partB} = {whole}</span>
        </div>
        {Array.from({ length: whole }, (_, index) => {
          const angle = -Math.PI / 2 + 2 * Math.PI * index / whole;
          const note = notes[index];
          const isAuthored = Boolean(note && index < authoredNoteCount);
          return (
            <button
              className={`${styles.note} ${isAuthored ? styles.notePlaced : note ? styles.noteSuggested : styles.noteEmpty}`}
              key={index}
              type="button"
              style={{ left: `${50 + Math.cos(angle) * 39}%`, top: `${50 + Math.sin(angle) * 39}%`, animationDelay: `${(index % 5) * -0.45}s` }}
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
                  title={available ? `Build make ${target}` : `This song needs at least ${target} spaced notes`}
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
          <strong>{authoredNoteCount} of {whole} notes placed</strong>
          <progress aria-label="Number of song notes placed" max={whole} value={Math.min(authoredNoteCount, whole)} />
          <span id="number-bonds-capacity">{capacityMessage}</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" disabled={!isSongLoaded || !canPlaceNotes || isPreparing} onClick={onBuildNotes}>
            {authoredNoteCount ? "Rebuild notes from song" : "Place notes from song"}
          </button>
          <button className={styles.primary} type="button" disabled={!canPlay || isPreparing} onClick={onPlay}>
            {isPreparing ? "Preparing mission…" : !isSongLoaded ? "Loading song notes…" : songCapacity < 2 && !isReady ? "Choose another song" : isReady ? "Play mission" : "Place notes & play"}
          </button>
        </div>
        {status ? <p className={styles.status} role="status">{status}</p> : null}
      </div>
    </section>
  );
}
