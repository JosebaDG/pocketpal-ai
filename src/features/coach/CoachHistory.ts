import type {CourseSnapshot} from './CoachCourseRepository';

type AnyNote = CourseSnapshot['studentNotes'][number] | CourseSnapshot['groupNotes'][number];

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const byTime = <T extends {at: string}>(items: T[]): T[] =>
  [...items].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

/** Notes whose latest review event is a flag, with the reason given. */
export function pendingReviews(snapshot: CourseSnapshot) {
  const latest = new Map<string, CourseSnapshot['reviewEvents'][number]>();
  for (const event of snapshot.reviewEvents) {
    latest.set(event.noteId, event);
  }
  const result: {note: AnyNote; kind: 'student' | 'group'; reason?: string}[] = [];
  for (const event of latest.values()) {
    if (event.action !== 'flag') {
      continue;
    }
    const student = snapshot.studentNotes.find(note => note.id === event.noteId);
    const group = snapshot.groupNotes.find(note => note.id === event.noteId);
    if (student) {
      result.push({note: student, kind: 'student', reason: event.reason});
    } else if (group) {
      result.push({note: group, kind: 'group', reason: event.reason});
    }
  }
  return result;
}

/** The whole individual history: it follows the student across groups. */
export function studentHistory(snapshot: CourseSnapshot, participantId: string) {
  const participant = snapshot.roster.participants.find(
    person => person.id === participantId,
  );
  if (!participant) {
    throw new Error('Unknown participant');
  }
  return {
    participant,
    notes: byTime(
      snapshot.studentNotes.filter(note => note.participantId === participantId),
    ),
    transfers: byTime(
      snapshot.transfers.filter(item => item.participantId === participantId),
    ),
    groupEvents: byTime(
      snapshot.groupEvents.filter(item => item.participantId === participantId),
    ),
  };
}

/** What was recorded in a group, left exactly where it was written. */
export function groupHistory(snapshot: CourseSnapshot, groupId: string) {
  const group = snapshot.roster.groups.find(item => item.id === groupId);
  if (!group) {
    throw new Error('Unknown group');
  }
  return {
    group,
    groupNotes: byTime(snapshot.groupNotes.filter(note => note.groupId === groupId)),
    studentNotes: byTime(
      snapshot.studentNotes.filter(note => note.groupId === groupId),
    ),
    events: byTime(snapshot.groupEvents.filter(item => item.groupId === groupId)),
  };
}

/** Name search over the whole course; several matches are flagged, never merged. */
export function findAcrossGroups(snapshot: CourseSnapshot, query: string) {
  const needle = fold(query);
  if (!needle) {
    return {matches: [], ambiguous: false};
  }
  const matches = snapshot.roster.participants
    .filter(person => fold(person.displayName).includes(needle))
    .map(person => ({
      participantId: person.id,
      displayName: person.displayName,
      groupId: person.groupId,
      status: person.status,
    }));
  return {matches, ambiguous: matches.length > 1};
}
