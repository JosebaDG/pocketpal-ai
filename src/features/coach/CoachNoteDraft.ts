import {dateWeekdayIndex, weekdayIndex} from './CoachSchedule';

/**
 * A note the person has reviewed on screen and is about to save. The id is not
 * part of the draft: it is derived from the content, so confirming the same
 * draft twice (double tap, retry after a slow write, a repeated tool call)
 * always lands on the same note.
 */
export type NoteDraft =
  | {
      kind: 'student';
      groupId: string;
      participantId: string;
      sessionDate: string;
      text: string;
    }
  | {
      kind: 'group';
      groupId: string;
      sessionDate: string;
      text: string;
    };

const DAY_MS = 86_400_000;

/**
 * The most recent date (today included) that falls on the group's weekday.
 * Returns today when the weekday name is not recognised.
 */
export function lastSessionDate(weekday: string, today: string): string {
  const index = weekdayIndex(weekday);
  if (index === -1) {
    return today;
  }
  const base = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(base)) {
    throw new Error('Invalid date');
  }
  for (let back = 0; back < 7; back += 1) {
    const day = new Date(base - back * DAY_MS).toISOString().slice(0, 10);
    if (dateWeekdayIndex(day) === index) {
      return day;
    }
  }
  return today;
}

/** Same text however it was typed or dictated: trimmed, NFC, single spaces. */
export function normaliseNoteText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ');
}

// cyrb53 (public domain): fast, synchronous, no native crypto needed.
/* eslint-disable no-bitwise */
function cyrb53(value: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0))
    .toString(16)
    .padStart(14, '0');
}
/* eslint-enable no-bitwise */

/**
 * Stable id for a draft: same kind, group, student, session date and text give
 * the same id. Fits the repository identifier rule ([a-zA-Z0-9_-]{1,64}).
 */
export function noteDraftId(draft: NoteDraft): string {
  const key = JSON.stringify([
    draft.kind,
    draft.groupId,
    draft.kind === 'student' ? draft.participantId : '',
    draft.sessionDate,
    normaliseNoteText(draft.text),
  ]);
  return `draft-${cyrb53(key, 1)}${cyrb53(key, 2)}`;
}
