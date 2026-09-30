import {z} from 'zod';

import {parseCoachRoster} from './CoachRoster';
import type {CoachRoster} from './CoachRoster';

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const timestamp = z.string().datetime({offset: true});
const body = z.string().trim().min(1).max(2000);
const scopeSchema = z
  .object({workspaceId: identifier, courseId: identifier})
  .strict();
const groupNoteSchema = z
  .object({id: identifier, groupId: identifier, at: timestamp, text: body})
  .strict();
const studentNoteSchema = groupNoteSchema
  .extend({participantId: identifier})
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
const snapshotSchema = scopeSchema
  .extend({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    roster: z.unknown(),
    studentNotes: z.array(studentNoteSchema),
    groupNotes: z.array(groupNoteSchema),
    transfers: z.array(transferSchema),
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
  const events = [...data.studentNotes, ...data.groupNotes, ...data.transfers];
  if (new Set(events.map(event => event.id)).size !== events.length) {
    throw new Error('Repeated event ID');
  }
  for (const note of [...data.studentNotes, ...data.groupNotes]) {
    if (!groups.has(note.groupId)) {
      throw new Error('Unknown historical group');
    }
  }
  for (const event of [...data.studentNotes, ...data.transfers]) {
    if (!participants.has(event.participantId)) {
      throw new Error('Unknown historical participant');
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
          studentNotes: [],
          groupNotes: [],
          transfers: [],
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

  /** Confirmation is the UI's responsibility, not a model-supplied boolean. */
  async appendStudentNoteConfirmed(
    participantId: string,
    groupId: string,
    text: string,
    at: string,
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
        studentNoteSchema.parse({id, participantId, groupId, text, at}),
      );
    });
  }

  async appendGroupNoteConfirmed(
    groupId: string,
    text: string,
    at: string,
  ): Promise<CourseSnapshot> {
    return this.change((data, id) => {
      if (!data.roster.groups.some(group => group.id === groupId)) {
        throw new Error('Unknown group');
      }
      data.groupNotes.push(groupNoteSchema.parse({id, groupId, text, at}));
    });
  }

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
    });
  }
}
