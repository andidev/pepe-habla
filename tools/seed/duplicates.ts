import type { Track, Word } from '@pepe/core';

/** Compare glosses the way a learner reads them: trimmed, case-insensitive. */
export const norm = (s: string): string => s.trim().toLowerCase();

/** Every value that appears more than once, normalised. */
export function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values.map(norm)) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/** A text that more than one card in the same track carries. */
export interface Collision {
  track: Track;
  text: string;
  ids: string[];
}

/**
 * Texts shared by two cards in the same track.
 *
 * Scoped by track on purpose. The rule exists because a question's four
 * options must have exactly one right answer, and since phase 3b a question's
 * distractors come from one track only (`apps/app/app/session.tsx` filters the
 * pool to `trackWords`). Two cards in different tracks are never options in the
 * same question, so they cannot collide. Scoping lets `como` be "as, like" in
 * words and "I eat" in grammar, which the 500-odd conjugations in grammar
 * levels 2-6 need.
 */
export function collisions(words: readonly Word[], key: 'es' | 'en' | 'sv'): Collision[] {
  const byTrack = new Map<Track, Map<string, Collision>>();
  for (const w of words) {
    const text = norm(w[key]);
    let byText = byTrack.get(w.track);
    if (byText === undefined) {
      byText = new Map<string, Collision>();
      byTrack.set(w.track, byText);
    }
    const found = byText.get(text);
    if (found === undefined) byText.set(text, { track: w.track, text, ids: [w.id] });
    else found.ids.push(w.id);
  }
  return [...byTrack.values()]
    .flatMap((byText) => [...byText.values()])
    .filter((c) => c.ids.length > 1)
    .sort((a, b) => a.track.localeCompare(b.track) || a.text.localeCompare(b.text));
}
