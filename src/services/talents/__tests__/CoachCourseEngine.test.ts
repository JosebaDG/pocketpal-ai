import {CoachCourseRepository} from '../../../features/coach/CoachCourseRepository';
import type {CoachCourseStorage} from '../../../features/coach/CoachCourseRepository';
import {parseCoachRoster} from '../../../features/coach/CoachRoster';
import {
  coachActiveCourse,
  defaultCoachCourseAccess,
} from '../../../features/coach/coachCourseAccess';
import {COACH_COURSE_ACTIONS, CoachCourseEngine} from '../CoachCourseEngine';

const scope = {workspaceId: 'demo-coach', courseId: 'demo-course'};
const WED = '2026-09-30';
const MON = '2026-09-28';
const iso = '2026-09-30T19:00:00Z';
const group = (id: string, weekday: string, startTime: string) => ({
  id,
  title: `${weekday} ${startTime}`,
  sport: 'swimming',
  weekday,
  startTime,
});
const roster = () =>
  parseCoachRoster(
    JSON.stringify({
      schemaVersion: 1,
      groups: [
        group('w1', 'miércoles', '17:00'),
        group('w2', 'miércoles', '17:35'),
        group('w3', 'miércoles', '18:15'),
        group('m1', 'lunes', '17:00'),
        group('nolevel', 'jueves', '17:00'),
      ],
      participants: [
        {
          id: 'p1',
          groupId: 'w1',
          displayName: 'Persona Demo',
          status: 'enrolled',
        },
        {
          id: 'p2',
          groupId: 'w2',
          displayName: 'Persona Otra',
          status: 'enrolled',
        },
        {
          id: 'p3',
          groupId: 'w3',
          displayName: 'Tercera Demo',
          status: 'enrolled',
        },
        {
          id: 'p4',
          groupId: 'm1',
          displayName: 'Persona Lunes',
          status: 'enrolled',
        },
        {
          id: 'p5',
          groupId: 'w1',
          displayName: 'Espera Demo',
          status: 'waiting',
        },
      ],
    }),
  );

// Wednesday 30 September 2026, local time. Classes run with 5 minutes between them.
const at = (hours: number, minutes: number) =>
  new Date(2026, 8, 30, hours, minutes);
const ids = (list: {groupId: string}[]) => list.map(item => item.groupId);

async function setup() {
  const values = new Map<string, string>();
  const key = (s: typeof scope) => `${s.workspaceId}:${s.courseId}`;
  const storage: CoachCourseStorage = {
    read: jest.fn(async s => values.get(key(s)) ?? null),
    write: jest.fn(async (s, value) => {
      values.set(key(s), value);
    }),
  };
  const repo = new CoachCourseRepository(scope, storage);
  await repo.createConfirmed(roster());
  await repo.setGroupLevelConfirmed('w1', 'familiarization');
  await repo.setGroupLevelConfirmed('w2', 'adaptation');
  await repo.setGroupLevelConfirmed('w3', 'perfecting');
  await repo.setGroupLevelConfirmed('m1', 'familiarization');
  const engineAt = (date: Date) =>
    new CoachCourseEngine({snapshot: () => repo.snapshot(), now: () => date});
  const run = async (engine: CoachCourseEngine, args: Record<string, any>) => {
    const result = await engine.execute(args);
    return {
      result,
      data: result.type === 'text' ? JSON.parse(result.summary) : null,
    };
  };
  return {repo, storage, engineAt, run};
}

// Synthetic course in memory. Proves behaviour, not model quality or device use.
describe('coach_course: what to do now', () => {
  it('puts the group in class first and offers the rest as alternatives', async () => {
    const {engineAt, run} = await setup();
    const {data} = await run(engineAt(at(17, 10)), {action: 'status'});
    expect(data.phase).toBe('in_session');
    expect(ids(data.nowAndRecent)).toEqual(['w1']);
    expect(ids(data.otherGroupsToday)).toEqual(['w2', 'w3']);
    expect(data.endedWithoutNotes).toEqual([]);
    expect(data.course).toEqual(scope);
  });

  it('in the five minutes between classes offers the one that just ended', async () => {
    const {engineAt, run} = await setup();
    const {data} = await run(engineAt(at(17, 32)), {action: 'status'});
    expect(data.phase).toBe('between_sessions');
    expect(ids(data.nowAndRecent)).toEqual(['w1']);
    expect(ids(data.endedWithoutNotes)).toEqual(['w1']);
  });

  it('after the block offers all three groups and says which have no note', async () => {
    const {repo, engineAt, run} = await setup();
    await repo.appendGroupNoteConfirmed('w2', 'Nota', iso, WED);
    const {data} = await run(engineAt(at(19, 5)), {action: 'status'});
    expect(data.phase).toBe('after_day');
    expect(ids(data.nowAndRecent)).toEqual(['w1', 'w2', 'w3']);
    expect(ids(data.endedWithoutNotes)).toEqual(['w1', 'w3']);
  });

  it('reports groups without a level instead of guessing their length', async () => {
    const {engineAt, run} = await setup();
    const {data} = await run(engineAt(new Date(2026, 9, 1, 12, 0)), {
      action: 'status',
    });
    expect(data.phase).toBe('no_sessions');
    expect(data.groupsWithoutLevel).toEqual(['nolevel']);
  });

  it('asks for a course when none is active', async () => {
    const engine = new CoachCourseEngine({
      snapshot: async () => null,
      now: () => at(17, 10),
    });
    const result = await engine.execute({action: 'status'});
    expect(result.type).toBe('error');
    expect(result.summary).toContain('No active course');
  });
});

describe('coach_course: choosing and finding', () => {
  it('lists every group so any of them can be chosen by hand', async () => {
    const {engineAt, run} = await setup();
    const {data} = await run(engineAt(at(17, 10)), {action: 'list_groups'});
    expect(data.groups.map((g: {id: string}) => g.id)).toEqual([
      'w1',
      'w2',
      'w3',
      'm1',
      'nolevel',
    ]);
    const first = data.groups[0];
    expect([first.level, first.enrolled, first.waiting]).toEqual([
      'familiarization',
      1,
      1,
    ]);
    expect(data.groups[4].level).toBeNull();
  });

  it('flags several matches and narrows by group when asked', async () => {
    const {engineAt, run} = await setup();
    const engine = engineAt(at(17, 10));
    const all = await run(engine, {
      action: 'find_participants',
      query: 'persona',
    });
    expect(all.data.ambiguous).toBe(true);
    expect(all.data.matches).toHaveLength(3);
    const one = await run(engine, {
      action: 'find_participants',
      query: 'persona',
      groupId: 'w1',
    });
    expect(one.data.ambiguous).toBe(false);
    expect(one.data.matches[0].participantId).toBe('p1');
    const bad = await run(engine, {
      action: 'find_participants',
      query: 'x',
      groupId: 'nope',
    });
    expect(bad.result.type).toBe('error');
  });
});

describe('coach_course: drafts', () => {
  it('prepares a draft for the suggested group and marks the manual choices', async () => {
    const {engineAt, run} = await setup();
    const engine = engineAt(at(17, 10));
    const suggested = await run(engine, {
      action: 'draft_note',
      kind: 'student',
      groupId: 'w1',
      participantId: 'p1',
      text: ' Se agarró al borde ',
    });
    expect(suggested.data).toMatchObject({
      status: 'DRAFT_NOT_SAVED',
      needsHumanConfirmation: true,
      participantName: 'Persona Demo',
      text: 'Se agarró al borde',
      sessionDate: WED,
      sessionDateSource: 'today',
      matchesSuggestedGroup: true,
    });
    const manual = await run(engine, {
      action: 'draft_note',
      kind: 'student',
      groupId: 'w3',
      participantId: 'p3',
      text: 'Idea para otro grupo',
    });
    expect(manual.data.status).toBe('DRAFT_NOT_SAVED');
    expect(manual.data.matchesSuggestedGroup).toBe(false);
    const monday = await run(engine, {
      action: 'draft_note',
      kind: 'group',
      groupId: 'm1',
      text: 'Repaso del lunes',
    });
    expect(monday.data.sessionDate).toBe(MON);
    expect(monday.data.sessionDateSource).toBe('last_occurrence');
    expect(monday.data.participantId).toBeNull();
  });

  it('rejects drafts that would attribute a note wrongly', async () => {
    const {engineAt, run} = await setup();
    const engine = engineAt(at(17, 10));
    const base = {
      action: 'draft_note',
      kind: 'student',
      groupId: 'w1',
      participantId: 'p1',
      text: 'x',
    };
    const bad: Record<string, any>[] = [
      {...base, participantId: 'p2'},
      {...base, participantId: 'p5'},
      {...base, sessionDate: MON},
      {...base, sessionDate: '2026-02-31'},
      {...base, groupId: 'nope'},
      {...base, kind: 'other'},
      {...base, text: '  '},
      {...base, text: 'x'.repeat(2001)},
    ];
    for (const args of bad) {
      expect((await run(engine, args)).result.type).toBe('error');
    }
  });

  it('never writes to storage, whatever it is asked', async () => {
    const {storage, engineAt, run} = await setup();
    const engine = engineAt(at(17, 10));
    const before = (storage.write as jest.Mock).mock.calls.length;
    for (const action of COACH_COURSE_ACTIONS) {
      await run(engine, {
        action,
        kind: 'group',
        groupId: 'w1',
        participantId: 'p1',
        query: 'persona',
        text: 'Borrador',
        noteId: 'event-1',
      });
    }
    expect((storage.write as jest.Mock).mock.calls.length).toBe(before);
    const actions = COACH_COURSE_ACTIONS.filter(a =>
      /save|delete|send|transfer|confirm|reset/.test(a),
    );
    expect(actions).toEqual([]);
  });
});

describe('coach_course: history and review', () => {
  it('shows the student history across groups and the group history as written', async () => {
    const {repo, engineAt, run} = await setup();
    const engine = engineAt(at(17, 10));
    await repo.appendStudentNoteConfirmed('p1', 'w1', 'Antes', iso, WED);
    await repo.transferConfirmed('p1', 'w2', iso, 'Cambio autorizado demo');
    const student = await run(engine, {
      action: 'student_history',
      participantId: 'p1',
    });
    expect(student.data.notes.map((n: {text: string}) => n.text)).toEqual([
      'Antes',
    ]);
    expect(student.data.transfers).toHaveLength(1);
    expect(student.data.groupEvents.map((e: {kind: string}) => e.kind)).toEqual(
      ['left', 'joined'],
    );
    const origin = await run(engine, {action: 'group_history', groupId: 'w1'});
    expect(origin.data.studentNotes).toHaveLength(1);
    expect(origin.data.events[0].kind).toBe('left');
  });

  it('drafts a review flag and lists what is pending', async () => {
    const {repo, engineAt, run} = await setup();
    const engine = engineAt(at(17, 10));
    const written = await repo.appendGroupNoteConfirmed(
      'w1',
      'Interesante',
      iso,
      WED,
    );
    const noteId = written.groupNotes[0].id;
    const draft = await run(engine, {
      action: 'draft_review_flag',
      noteId,
      reason: 'Repasar',
    });
    expect(draft.data).toMatchObject({
      status: 'DRAFT_NOT_SAVED',
      noteId,
      reason: 'Repasar',
    });
    expect(
      (await run(engine, {action: 'pending_reviews'})).data.pending,
    ).toEqual([]);
    await repo.flagForReviewConfirmed(noteId, iso, 'Repasar');
    const pending = await run(engine, {action: 'pending_reviews'});
    expect(pending.data.pending[0]).toMatchObject({noteId, reason: 'Repasar'});
    expect(
      (await run(engine, {action: 'draft_review_flag', noteId})).result.type,
    ).toBe('error');
    expect(
      (await run(engine, {action: 'draft_review_flag', noteId: 'missing'}))
        .result.type,
    ).toBe('error');
  });
});

describe('coach_course: tool definition and active course', () => {
  it('declares a single required action', () => {
    const definition = new CoachCourseEngine().toToolDefinition() as any;
    expect(definition.function.name).toBe('coach_course');
    expect(definition.function.parameters.required).toEqual(['action']);
    expect(definition.function.parameters.properties.action.enum).toEqual([
      ...COACH_COURSE_ACTIONS,
    ]);
  });

  it('keeps the active course under the control of trusted code', async () => {
    expect(coachActiveCourse.get()).toBeNull();
    expect(await defaultCoachCourseAccess.snapshot()).toBeNull();
    coachActiveCourse.set(scope);
    expect(coachActiveCourse.get()).toEqual(scope);
    expect(() =>
      coachActiveCourse.set({workspaceId: 'bad id!', courseId: 'x'}),
    ).toThrow('Invalid course scope');
    coachActiveCourse.set(null);
    expect(coachActiveCourse.get()).toBeNull();
  });
});
