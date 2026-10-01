import {z} from 'zod';

import {parseCoachRoster} from './CoachRoster';
import type {CoachRoster} from './CoachRoster';
import {GROUP_LEVELS, dateWeekdayIndex, weekdayIndex} from './CoachSchedule';
import type {GroupLevel} from './CoachSchedule';

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const timestamp = z.string().datetime({offset: true});
const body = z.string().trim().min(1).max(2000);
const sessionDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
    );
  }, 'Invalid session date');
const scopeSchema = z
  .object({workspaceId: identifier, courseId: identifier})
  .strict();
const noteFields = {
  id: identifier,
  groupId: identifier,
  at: timestamp,
  text: body,
  sessionDate: sessionDate.optional(),
};
const groupNoteSchema = z.object(noteFields).strict();
const studentNoteSchema = z
  .object({...noteFields, participantId: identifier})
  .strict();
const transferSchema = z
  .object({
    id: identifier,
    participantId: identifier,
    fromGroupId: identifier,
    toGroupId: identifier,
    at: timestamp,
    justification: body,
  })
  .strict();
const groupEventSchema = z
  .object({
    id: identifier,
    groupId: identifier,
    participantId: identifier,
    at: timestamp,
    kind: z.enum(['joined', 'left']),
    transferId: identifier.optional(),
  })
  .strict();
const reviewEventSchema = z
  .object({
    id: identifier,
    noteId: identifier,
    at: timestamp,
    action: z.enum(['flag', 'resolve']),
    reason: body.optional(),
  })
  .strict();
const snapshotSchema = scopeSchema
  .extend({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    roster: z.unknown(),
    levels: z.record(identifier, z.enum(GROUP_LEVELS)).default({}),
    studentNotes: z.array(studentNoteSchema),
    groupNotes: z.array(groupNoteSchema),
    transfers: z.array(transferSchema),
    groupEvents: z.array(groupEventSchema).default([]),
    reviewEvents: z.array(reviewEventSchema).default([]),
  })
  .strict();

export type CourseScope = z.infer<typeof scopeSchema>;
export type CourseSnapshot = Omit<
  z.infer<typeof snapshotSchema>,
  'roster'
> & {roster: CoachRoster};

/** Trusted storage port. Production needs a protected, transactional adapter. */
export interface CoachCourseStorage {
  read(scope: CourseScope): Promise<string | null>;
  write(scope: CourseScope, snapshot: string): Promise<void>;
}

/** A session date must fall on the weekday of its group (when recognisable). */
function assertSessionDay(roster: CoachRoster, groupId: string, date: string) {
  const group = roster.groups.find(item => item.id === groupId);
  const expected = group ? weekdayIndex(group.weekday) : -1;
  if (expected !== -1 && expected !== dateWeekdayIndex(date)) {
    throw new Error('Session date does not match the group weekday');
  }
}

function isFlagged(data: CourseSnapshot, noteId: string): boolean {
  const events = data.reviewEvents.filter(event => event.noteId === noteId);
  return events[events.length - 1]?.action === 'flag';
}

function assertNoteExists(data: CourseSnapshot, noteId: string) {
  const notes = [...data.studentNotes, ...data.groupNotes];
  if (!notes.some(note => note.id === noteId)) {
    throw new Error('Unknown note');
  }
}

function validateSnapshot(raw: unknown, scope: CourseScope): CourseSnapshot {
  const data = snapshotSchema.parse(raw);
  if (
    data.workspaceId !== scope.workspaceId ||
    data.courseId !== scope.courseId
  ) {
    throw new Error('Course scope mismatch');
  }
  const roster = parseCoachRoster(JSON.stringify(data.roster));
  const groups = new Set(roster.groups.map(group => group.id));
  const participants = new Set(roster.participants.map(person => person.id));
  const notes = [...data.studentNotes, ...data.groupNotes];
  const events = [
    ...notes,
    ...data.transfers,
    ...data.groupEvents,
    ...data.reviewEvents,
  ];
  if (new Set(events.map(event => event.id)).size !== events.length) {
    throw new Error('Repeated event ID');
  }
  for (const note of notes) {
    if (!groups.has(note.groupId)) {
      throw new Error('Unknown historical group');
    }
    if (note.sessionDate !== undefined) {
      assertSessionDay(roster, note.groupId, note.sessionDate);
    }
  }
  for (const event of [
    ...data.studentNotes,
    ...data.transfers,
    ...data.groupEvents,
  ]) {
    if (!participants.has(event.participantId)) {
      throw new Error('Unknown historical participant');
    }
  }
  for (const event of data.groupEvents) {
    if (!groups.has(event.groupId)) {
      throw new Error('Unknown historical group');
    }
  }
  for (const transfer of data.transfers) {
    if (
      !groups.has(transfer.fromGroupId) ||
      !groups.has(transfer.toGroupId) ||
      transfer.fromGroupId === transfer.toGroupId
    ) {
      throw new Error('Invalid historical transfer');
    }
  }
  for (const groupId of Object.keys(data.levels)) {
    if (!groups.has(groupId)) {
      throw new Error('Level set for unknown group');
    }
  }
  const noteIds = new Set(notes.map(note => note.id));
  for (const event of data.reviewEvents) {
    if (!noteIds.has(event.noteId)) {
      throw new Error('Review of unknown note');
    }
  }
  return {...data, roster};
}

/** Not a Talent: only trusted application/UI code may invoke writes. */
export class CoachCourseRepository {
  private readonly scope: CourseScope;
  private pending: Promise<void> = Promise.resolve();

  constructor(
    scope: CourseScope,
    private readonly storage: CoachCourseStorage,
  ) {
    this.scope = scopeSchema.parse(scope);
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const result = this.pending.then(task);
    this.pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async load(): Promise<CourseSnapshot> {
    const raw = await this.storage.read({...this.scope});
    if (raw === null) {
      throw new Error('Course not imported');
    }
    return validateSnapshot(JSON.parse(raw), this.scope);
  }

  async snapshot(): Promise<CourseSnapshot> {
    return this.serial(() => this.load());
  }

  /** Call after import preview/confirmation. Never replaces an existing course. */
  async createConfirmed(roster: CoachRoster): Promise<CourseSnapshot> {
    return this.serial(async () => {
      if ((await this.storage.read({...this.scope})) !== null) {
        throw new Error('Course already exists');
      }
      const data = validateSnapshot(
        {
          ...this.scope,
          version: 1,
          revision: 0,
          roster,
          levels: {},
          studentNotes: [],
          groupNotes: [],
          transfers: [],
          groupEvents: [],
          reviewEvents: [],
        },
        this.scope,
      );
      await this.storage.write({...this.scope}, JSON.stringify(data));
      return data;
    });
  }

  private async change(
    mutate: (data: CourseSnapshot, eventId: string) => void,
  ): Promise<CourseSnapshot> {
    return this.serial(async () => {
      const data = await this.load();
      data.revision += 1;
      mutate(data, `event-${data.revision}`);
      const validated = validateSnapshot(data, this.scope);
      await this.storage.write({...this.scope}, JSON.stringify(validated));
      return validated;
    });
  }

  /** Sets the level that determines the pool time of a group's sessions. */
  async setGroupLevelConfirmed(
    groupId: string,
    level: GroupLevel,
  ): Promise<CourseSnapshot> {
    return this.change(data => {
      if (!data.roster.groups.some(group => group.id === groupId)) {
        throw new Error('Unknown group');
      }
      data.levels[groupId] = z.enum(GROUP_LEVELS).parse(level);
    });
  }

  /**
   * Confirmation is the UI's responsibility, not a model-supplied boolean.
   * sessionDate (YYYY-MM-DD) says which class the note is about; it may differ
   * from the moment of writing when notes are taken after a block of sessions.
   */
  async appendStudentNoteConfirmed(
    participantId: string,
    groupId: string,
    text: string,
    at: string,
    sessionDate?: string,
  ): Promise<CourseSnapshot> {
    return this.change((data, id) => {
      const person = data.roster.participants.find(
        item =>
          item.id === participantId &&
          item.groupId === groupId &&
          item.status === 'enrolled',
      );
      if (!person) {
        throw new Error('Participant not enrolled in selected group');
      }
      data.studentNotes.push(
        studentNoteSchema.parse({
          id,
          participantId,
          groupId,
          text,
          at,
          sessionDate,
        }),
      );
    });
  }

  async appendGroupNoteConfirmed(
    groupId: string,
    text: string,
    at: string,
    sessionDate?: string,
  ): Promise<CourseSnapshot> {
    return this.change((data, id) => {
      if (!data.roster.groups.some(group => group.id === groupId)) {
        throw new Error('Unknown group');
      }
      data.groupNotes.push(
        groupNoteSchema.parse({id, groupId, text, at, sessionDate}),
      );
    });
  }

  /**
   * Moves the active group and appends dated history: the transfer itself plus
   * a left/joined event for each group. Earlier notes are never touched.
   */
  async transferConfirmed(
    participantId: string,
    toGroupId: string,
    at: string,
    justification: string,
  ): Promise<CourseSnapshot> {
    return this.change((data, id) => {
      const person = data.roster.participants.find(
        item => item.id === participantId,
      );
      if (!person || !data.roster.groups.some(group => group.id === toGroupId)) {
        throw new Error('Unknown participant or destination group');
      }
      const transfer = transferSchema.parse({
        id,
        participantId,
        fromGroupId: person.groupId,
        toGroupId,
        at,
        justification,
      });
      if (transfer.fromGroupId === transfer.toGroupId) {
        throw new Error('Participant already in destination group');
      }
      const prior = data.transfers
        .filter(event => event.participantId === participantId)
        .at(-1);
      if (prior && Date.parse(at) < Date.parse(prior.at)) {
        throw new Error('Transfer predates previous transfer');
      }
      person.groupId = toGroupId;
      data.transfers.push(transfer);
      data.groupEvents.push(
        groupEventSchema.parse({
          id: `${id}-left`,
          groupId: transfer.fromGroupId,
          participantId,
          at,
          kind: 'left',
          transferId: id,
        }),
        groupEventSchema.parse({
          id: `${id}-joined`,
          groupId: toGroupId,
          participantId,
          at,
          kind: 'joined',
          transferId: id,
        }),
      );
    });
  }

  /** Marks a note to be reviewed later ("repasar estos apuntes"). */
  async flagForReviewConfirmed(
    noteId: string,
    at: string,
    reason?: string,
  ): Promise<CourseSnapshot> {
    return this.change((data, id) => {
      assertNoteExists(data, noteId);
      if (isFlagged(data, noteId)) {
        throw new Error('Note already flagged for review');
      }
      data.reviewEvents.push(
        reviewEventSchema.parse({id, noteId, at, action: 'flag', reason}),
      );
    });
  }

  async resolveReviewConfirmed(
    noteId: string,
    at: string,
  ): Promise<CourseSnapshot> {
    return this.change((data, id) => {
      assertNoteExists(data, noteId);
      if (!isFlagged(data, noteId)) {
        throw new Error('Note is not pending review');
      }
      data.reviewEvents.push(
        reviewEventSchema.parse({id, noteId, at, action: 'resolve'}),
      );
    });
  }
}
