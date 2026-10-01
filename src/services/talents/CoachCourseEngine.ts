import type {CourseSnapshot} from '../../features/coach/CoachCourseRepository';
import {
  findAcrossGroups,
  groupHistory,
  pendingReviews,
  studentHistory,
} from '../../features/coach/CoachHistory';
import {
  clockFrom,
  dateWeekdayIndex,
  formatMinute,
  noteTargets,
  notedGroupIds,
  slotsForDate,
  weekdayIndex,
} from '../../features/coach/CoachSchedule';
import type {SessionSlot} from '../../features/coach/CoachSchedule';
import {defaultCoachCourseAccess} from '../../features/coach/coachCourseAccess';
import type {CoachCourseAccess} from '../../features/coach/coachCourseAccess';
import type {TalentEngine, TalentResult, ToolDefinition} from './types';

export const COACH_COURSE_ACTIONS = [
  'status',
  'list_groups',
  'find_participants',
  'student_history',
  'group_history',
  'pending_reviews',
  'draft_note',
  'draft_review_flag',
] as const;

const MAX_NOTES = 30;
const MAX_RESULTS = 20;
const MAX_TEXT = 2000;

const reply = (data: unknown): TalentResult => ({
  type: 'text',
  summary: JSON.stringify(data),
});
const fail = (message: string): TalentResult => ({
  type: 'error',
  summary: message,
  errorMessage: message,
});
const required = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing ${name}`);
  }
  return value.trim();
};

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function lastOccurrence(today: string, weekday: number): string {
  const base = Date.parse(`${today}T00:00:00Z`);
  for (let back = 0; back < 7; back += 1) {
    const day = new Date(base - back * 86400000).toISOString().slice(0, 10);
    if (dateWeekdayIndex(day) === weekday) {
      return day;
    }
  }
  return today;
}

function resolveSessionDate(
  group: {weekday: string},
  given: unknown,
  today: string,
) {
  const index = weekdayIndex(group.weekday);
  if (given !== undefined && given !== null && given !== '') {
    if (typeof given !== 'string' || !validDate(given)) {
      throw new Error('Invalid sessionDate: use YYYY-MM-DD');
    }
    if (index !== -1 && dateWeekdayIndex(given) !== index) {
      throw new Error('sessionDate does not fall on the weekday of that group');
    }
    return {sessionDate: given, source: 'given'};
  }
  if (index === -1) {
    return {sessionDate: today, source: 'today'};
  }
  const sessionDate = lastOccurrence(today, index);
  return {
    sessionDate,
    source: sessionDate === today ? 'today' : 'last_occurrence',
  };
}

function suggestion(snap: CourseSnapshot, now: Date) {
  const clock = clockFrom(now);
  const {slots, missingLevel} = slotsForDate(
    snap.roster.groups,
    snap.levels,
    clock.date,
  );
  const noted = notedGroupIds(
    [...snap.groupNotes, ...snap.studentNotes],
    clock.date,
  );
  return {clock, missingLevel, targets: noteTargets(slots, noted, clock)};
}

const describeSlot = (slot: SessionSlot) => ({
  groupId: slot.groupId,
  title: slot.title,
  level: slot.level,
  start: formatMinute(slot.startMinute),
  end: formatMinute(slot.endMinute),
});

const noteView = (note: {
  id: string;
  groupId: string;
  sessionDate?: string;
  at: string;
  text: string;
}) => ({
  id: note.id,
  groupId: note.groupId,
  sessionDate: note.sessionDate ?? null,
  at: note.at,
  text: note.text,
});

function status(snap: CourseSnapshot, now: Date) {
  const {clock, missingLevel, targets} = suggestion(snap, now);
  return {
    course: {workspaceId: snap.workspaceId, courseId: snap.courseId},
    date: clock.date,
    time: formatMinute(clock.minute),
    phase: targets.phase,
    nowAndRecent: targets.primary.map(describeSlot),
    otherGroupsToday: targets.others.map(describeSlot),
    endedWithoutNotes: targets.missing.map(describeSlot),
    groupsWithoutLevel: missingLevel,
    pendingReviews: pendingReviews(snap).length,
    manualChoice:
      'These are suggestions only. Any group from list_groups can be chosen.',
  };
}

function listGroups(snap: CourseSnapshot) {
  return {
    groups: snap.roster.groups.map(group => {
      const members = snap.roster.participants.filter(
        person => person.groupId === group.id,
      );
      return {
        id: group.id,
        title: group.title,
        weekday: group.weekday,
        startTime: group.startTime,
        level: snap.levels[group.id] ?? null,
        enrolled: members.filter(person => person.status === 'enrolled').length,
        waiting: members.filter(person => person.status === 'waiting').length,
      };
    }),
  };
}

function findParticipants(snap: CourseSnapshot, args: Record<string, any>) {
  const query = required(args.query, 'query');
  const groupId =
    typeof args.groupId === 'string' && args.groupId.trim()
      ? args.groupId.trim()
      : null;
  if (groupId && !snap.roster.groups.some(group => group.id === groupId)) {
    throw new Error('Unknown group');
  }
  const found = findAcrossGroups(snap, query);
  const matches = groupId
    ? found.matches.filter(match => match.groupId === groupId)
    : found.matches;
  return {
    matches: matches.slice(0, MAX_RESULTS),
    truncated: matches.length > MAX_RESULTS,
    ambiguous: matches.length > 1,
  };
}

function studentView(snap: CourseSnapshot, args: Record<string, any>) {
  const history = studentHistory(
    snap,
    required(args.participantId, 'participantId'),
  );
  return {
    participant: {
      id: history.participant.id,
      displayName: history.participant.displayName,
      groupId: history.participant.groupId,
      status: history.participant.status,
    },
    notes: history.notes.slice(-MAX_NOTES).map(noteView),
    truncated: history.notes.length > MAX_NOTES,
    transfers: history.transfers.map(item => ({
      fromGroupId: item.fromGroupId,
      toGroupId: item.toGroupId,
      at: item.at,
      justification: item.justification,
    })),
    groupEvents: history.groupEvents.map(item => ({
      groupId: item.groupId,
      kind: item.kind,
      at: item.at,
    })),
  };
}

function groupView(snap: CourseSnapshot, args: Record<string, any>) {
  const history = groupHistory(snap, required(args.groupId, 'groupId'));
  return {
    group: {id: history.group.id, title: history.group.title},
    groupNotes: history.groupNotes.slice(-MAX_NOTES).map(noteView),
    studentNotes: history.studentNotes.slice(-MAX_NOTES).map(note => ({
      ...noteView(note),
      participantId: note.participantId,
    })),
    events: history.events.map(item => ({
      participantId: item.participantId,
      kind: item.kind,
      at: item.at,
    })),
  };
}

function reviewsView(snap: CourseSnapshot) {
  return {
    pending: pendingReviews(snap).map(item => ({
      noteId: item.note.id,
      kind: item.kind,
      groupId: item.note.groupId,
      sessionDate: item.note.sessionDate ?? null,
      text: item.note.text,
      reason: item.reason ?? null,
    })),
  };
}

function draftNote(snap: CourseSnapshot, now: Date, args: Record<string, any>) {
  const kind = required(args.kind, 'kind');
  if (kind !== 'student' && kind !== 'group') {
    throw new Error('kind must be student or group');
  }
  const groupId = required(args.groupId, 'groupId');
  const group = snap.roster.groups.find(item => item.id === groupId);
  if (!group) {
    throw new Error('Unknown group');
  }
  const text = required(args.text, 'text');
  if (text.length > MAX_TEXT) {
    throw new Error('Text too long');
  }
  const {clock, targets} = suggestion(snap, now);
  const {sessionDate, source} = resolveSessionDate(group, args.sessionDate, clock.date);
  let participant;
  if (kind === 'student') {
    const participantId = required(args.participantId, 'participantId');
    participant = snap.roster.participants.find(
      person =>
        person.id === participantId &&
        person.groupId === group.id &&
        person.status === 'enrolled',
    );
    if (!participant) {
      throw new Error('Participant not enrolled in the selected group');
    }
  }
  return {
    status: 'DRAFT_NOT_SAVED',
    needsHumanConfirmation: true,
    kind,
    groupId: group.id,
    participantId: participant?.id ?? null,
    participantName: participant?.displayName ?? null,
    text,
    sessionDate,
    sessionDateSource: source,
    matchesSuggestedGroup: targets.primary.some(
      slot => slot.groupId === group.id,
    ),
  };
}

function draftReviewFlag(snap: CourseSnapshot, args: Record<string, any>) {
  const noteId = required(args.noteId, 'noteId');
  const notes = [...snap.studentNotes, ...snap.groupNotes];
  if (!notes.some(note => note.id === noteId)) {
    throw new Error('Unknown note');
  }
  if (pendingReviews(snap).some(item => item.note.id === noteId)) {
    throw new Error('Note already flagged for review');
  }
  const reason =
    typeof args.reason === 'string' && args.reason.trim()
      ? args.reason.trim().slice(0, MAX_TEXT)
      : null;
  return {
    status: 'DRAFT_NOT_SAVED',
    needsHumanConfirmation: true,
    noteId,
    reason,
  };
}

/**
 * Read-only view of the course the person chose in the app, plus drafts.
 * It never saves, moves, deletes or switches course: the app does that after
 * explicit confirmation. Suggestions follow the clock but never restrict the
 * choice of group.
 */
export class CoachCourseEngine implements TalentEngine {
  readonly name = 'coach_course';

  constructor(
    private readonly access: CoachCourseAccess = defaultCoachCourseAccess,
  ) {}

  async execute(args: Record<string, any>): Promise<TalentResult> {
    try {
      const snap = await this.access.snapshot();
      if (!snap) {
        return fail(
          'No active course: ask the person to choose a course in the app',
        );
      }
      const now = this.access.now();
      switch (args.action) {
        case 'status':
          return reply(status(snap, now));
        case 'list_groups':
          return reply(listGroups(snap));
        case 'find_participants':
          return reply(findParticipants(snap, args));
        case 'student_history':
          return reply(studentView(snap, args));
        case 'group_history':
          return reply(groupView(snap, args));
        case 'pending_reviews':
          return reply(reviewsView(snap));
        case 'draft_note':
          return reply(draftNote(snap, now, args));
        case 'draft_review_flag':
          return reply(draftReviewFlag(snap, args));
        default:
          return fail('Unknown coach_course action');
      }
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Action failed');
    }
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          'Read-only access to the active coaching course, plus drafts. Never saves, sends, moves or deletes: the app asks the person to confirm. The course is chosen in the app. Pass groupId explicitly for anything about a group.',
        parameters: {
          type: 'object',
          properties: {
            action: {type: 'string', enum: [...COACH_COURSE_ACTIONS]},
            groupId: {type: 'string'},
            participantId: {type: 'string'},
            query: {type: 'string'},
            kind: {type: 'string', enum: ['student', 'group']},
            text: {type: 'string'},
            sessionDate: {
              type: 'string',
              description: 'YYYY-MM-DD of the class the note is about',
            },
            noteId: {type: 'string'},
            reason: {type: 'string'},
          },
          required: ['action'],
        },
      },
    } as ToolDefinition;
  }
}
