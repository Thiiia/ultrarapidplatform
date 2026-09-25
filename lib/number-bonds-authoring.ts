import type { AuthoredSavedEquation } from "./authored-lesson-serialization";

export const NUMBER_BONDS_MIN_WHOLE = 2;
export const NUMBER_BONDS_MAX_WHOLE = 20;

export type NumberBondValues = {
  whole: number;
  partA: number;
  partB: number;
};

type EquationLike = Pick<AuthoredSavedEquation, "tokens"> | { state: string };

/** Stable song-specific random-looking whole, so opening the editor won't reroll it. */
export function getDefaultNumberBondWholeForSong(songAssetId: string): number {
  const normalizedSongId = songAssetId.trim().toLowerCase() || "number-bonds";
  const seed = normalizedSongId + ":number-bond-whole";
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return NUMBER_BONDS_MIN_WHOLE + (hash % (NUMBER_BONDS_MAX_WHOLE - NUMBER_BONDS_MIN_WHOLE + 1));
}

export function getNumberBondValues(equation: EquationLike): NumberBondValues | null {
  const state = "tokens" in equation
    ? equation.tokens.map((token) => token.label).join(" ")
    : equation.state;
  const normalized = state.replace(/\s+/g, " ").trim();
  const leftToRight = normalized.match(/^(\d+)\s*=\s*(\d+)\s*\+\s*(\d+)$/);
  const rightToLeft = normalized.match(/^(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)$/);
  const match = leftToRight ?? rightToLeft;
  if (!match) return null;

  const [first, second, third] = match.slice(1).map(Number);
  const whole = leftToRight ? first : third;
  const partA = leftToRight ? second : first;
  const partB = leftToRight ? third : second;
  if (
    !Number.isInteger(whole) ||
    whole < NUMBER_BONDS_MIN_WHOLE ||
    whole > NUMBER_BONDS_MAX_WHOLE ||
    !Number.isInteger(partA) ||
    !Number.isInteger(partB) ||
    partA <= 0 ||
    partB <= 0 ||
    partA + partB !== whole
  ) {
    return null;
  }

  return { whole, partA, partB };
}

export function createNumberBondEquation(
  whole: number,
  partA: number,
  id: string,
): AuthoredSavedEquation {
  const partB = whole - partA;
  if (
    !Number.isInteger(whole) ||
    whole < 2 ||
    whole > NUMBER_BONDS_MAX_WHOLE
  ) {
    throw new RangeError(`Number Bonds whole must be between 2 and ${NUMBER_BONDS_MAX_WHOLE}.`);
  }
  if (!Number.isInteger(partA) || partA <= 0 || partB <= 0) {
    throw new RangeError("Number Bonds requires two positive parts smaller than the whole.");
  }

  const stableId = id.trim() || "number-bond";
  const token = (label: string, suffix: string) => ({
    id: `${stableId}:${suffix}`,
    label,
  });
  return {
    id: stableId,
    tokens: [
      token(String(whole), "whole"),
      token("=", "equals"),
      token(String(partA), "part-a"),
      token("+", "plus"),
      token(String(partB), "part-b"),
    ],
  };
}

/** A saved song starts with a repeatable random-looking bond; authors can edit or reroll it. */
export function createDefaultNumberBondForSong(
  songAssetId: string,
  whole: number,
  variation = 0,
): NumberBondValues {
  if (!Number.isInteger(whole) || whole < 2 || whole > NUMBER_BONDS_MAX_WHOLE) {
    throw new RangeError(`Number Bonds whole must be between 2 and ${NUMBER_BONDS_MAX_WHOLE}.`);
  }

  const normalizedSongId = songAssetId.trim().toLowerCase() || "number-bonds";
  const seed = `${normalizedSongId}:number-bond`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  const partCount = whole - 1;
  const reroll = Math.max(0, Math.floor(variation));
  const partA = 1 + ((hash % partCount + reroll) % partCount);
  return { whole, partA, partB: whole - partA };
}
