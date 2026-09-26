"use client";

import { useState } from "react";
import styles from "./NumberBondsMissionComposer.module.css";

type OrbitNote = { id: string; seconds: number };

export function NumberBondsMissionComposer({
  whole,
  songTitle,
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
  songTitle: string;
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

  const maxSelectableWhole = Math.min(20, songCapacity);
  const canChooseNumber = isSongLoaded && maxSelectableWhole >= 2 && !isPreparing;
  const canPlaceNotes = songCapacity >= whole;
  const canPlay = isSongLoaded && (isReady || canPlaceNotes);

  return (
    <section className={styles.composer} aria-label="Number Bonds mission composer">
      <div className={styles.intro}>
        <span className={styles.eyebrow}>NUMBER BONDS · {songTitle}</span>
        <h1>Make a number. Play the song.</h1>
        <p>Choose the big number, then press Play. The song places one bouncing gem for each orbiting note. Changing the number rebuilds its notes; you can adjust their timing below.</p>
      </div>

      <div className={styles.orbit} aria-label={`Make ${whole} with ${whole} notes`}>
        <div className={styles.orbitRing} aria-hidden="true" />
        <div className={styles.orbitCore}>
          <span>MAKE</span>
          <strong>{whole}</strong>
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
        <div className={styles.targetRow}>
          <button type="button" aria-label="Decrease number" disabled={!canChooseNumber || whole <= 2} onClick={() => onWholeChange(Math.min(whole - 1, maxSelectableWhole))}>−</button>
          <label>
            <span>Number to make</span>
            <input type="number" min={2} max={Math.max(2, maxSelectableWhole)} step={1} value={wholeText} disabled={!canChooseNumber}
              onChange={(event) => {
                const nextText = event.currentTarget.value;
                setWholeDraft({ whole, songCapacity, text: nextText });
                const next = Number(nextText);
                if (nextText && Number.isInteger(next) && next >= 2 && next <= maxSelectableWhole && next !== whole) {
                  onWholeChange(next);
                }
              }}
              onBlur={() => setWholeDraft({ whole, songCapacity, text: String(whole) })}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </label>
          <button type="button" aria-label="Increase number" disabled={!canChooseNumber || whole >= maxSelectableWhole} onClick={() => onWholeChange(whole + 1)}>+</button>
          <button className={styles.shuffle} type="button" disabled={!canChooseNumber || maxSelectableWhole < 3} onClick={onShuffle}>Shuffle</button>
        </div>

        <div className={styles.progress} role="status">
          <strong>{authoredNoteCount} of {whole} notes placed</strong>
          <span>{!isSongLoaded
            ? "Loading song notes…"
            : songCapacity >= 2
            ? `This song has room for up to ${Math.min(20, songCapacity)} spaced notes.`
            : "This song has fewer than two playable, spaced notes."}</span>
        </div>
        {isSongLoaded && !canPlaceNotes && !isReady ? (
          <p className={styles.notice}>{songCapacity >= 2
            ? `Choose ${Math.min(20, songCapacity)} or fewer for this song, or select a longer song.`
            : "Select another song with at least two playable, spaced notes."}</p>
        ) : null}
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" disabled={!isSongLoaded || !canPlaceNotes || isPreparing} onClick={onBuildNotes}>
            {authoredNoteCount ? "Rebuild notes from song" : "Place notes from song"}
          </button>
          <button className={styles.primary} type="button" disabled={!canPlay || isPreparing} onClick={onPlay}>
            {isPreparing ? "Preparing mission…" : !isSongLoaded ? "Loading song notes…" : songCapacity < 2 && !isReady ? "Choose another song" : isReady ? "Play mission" : "Place notes & play"}
          </button>
        </div>
        {status ? <p className={styles.notice} role="status">{status}</p> : null}
      </div>
    </section>
  );
}
