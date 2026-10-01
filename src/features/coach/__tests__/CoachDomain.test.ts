import {CoachCourseRepository} from '../CoachCourseRepository';
import type {CoachCourseStorage} from '../CoachCourseRepository';
import {
  findAcrossGroups,
  groupHistory,
  pendingReviews,
  studentHistory,
} from '../CoachHistory';
import {parseCoachRoster} from '../CoachRoster';

const scope = {workspaceId: 'demo-coach', courseId: 'demo-course'};
const MONDAY = '2026-09-28';
const WEDNESDAY = '2026-09-30';
const monday = '2026-09-28T19:00:00Z';
const wednesday = '2026-09-30T19:00:00Z';
const roster = () =>
  parseCoachRoster(
    JSON.stringify({
      schemaVersion: 1,
      groups: [
        {
          id: 'mon',
          title: 'Lunes 17:00',
          sport: 'swimming',
          weekday: 'lunes',
          startTime: '17:00',
        },
        {
          id: 'wed',
          title: 'Miércoles 17:00',
          sport: 'swimming',
          weekday: 'miércoles',
          startTime: '17:00',
        },
      ],
      participants: [
        {
          id: 'p1',
          groupId: 'mon',
          displayName: 'Persona Demo',
          status: 'enrolled',
        },
        {
          id: 'p2',
          groupId: 'wed',
          displayName: 'Persona Otra',
          status: 'enrolled',
        },
      ],
    }),
  );

function memoryStorage() {
  const values = new Map<string, string>();
  const key = (s: typeof scope) => `${s.workspaceId}:${s.courseId}`;
  const storage: CoachCourseStorage = {
    read: jest.fn(async s => values.get(key(s)) ?? null),
    write: jest.fn(async (s, value) => {
      values.set(key(s), value);
    }),
  };
  return {storage, values, key};
}

async function course() {
  const parts = memoryStorage();
  const repo = new CoachCourseRepository(scope, parts.storage);
  await repo.createConfirmed(roster());
  return {repo, ...parts};
}

// Synthetic storage and people only; not proof of device persistence.
describe('course domain: levels, sessions, events and review', () => {
  it('loads snapshots saved before these fields existed', async () => {
    const {storage, values, key} = await course();
    const legacy = JSON.parse(values.get(key(scope)) as string);
    delete legacy.levels;
    delete legacy.groupEvents;
    delete legacy.reviewEvents;
    values.set(key(scope), JSON.stringify(legacy));
    const loaded = await new CoachCourseRepository(scope, storage).snapshot();
    expect(loaded.levels).toEqual({});
    expect(loaded.groupEvents).toEqual([]);
    expect(loaded.reviewEvents).toEqual([]);
  });

  it('stores the level of a group and rejects unknown groups or levels', async () => {
    const {repo} = await course();
    const snap = await repo.setGroupLevelConfirmed('mon', 'adaptation');
    expect(snap.levels).toEqual({mon: 'adaptation'});
    await expect(
      repo.setGroupLevelConfirmed('nope', 'adaptation'),
    ).rejects.toThrow('Unknown group');
    await expect(
      repo.setGroupLevelConfirmed('mon', 'deep' as never),
    ).rejects.toThrow();
  });

  it('links notes to the class they are about and checks the weekday', async () => {
    const {repo} = await course();
    const snap = await repo.appendGroupNoteConfirmed(
      'mon',
      'Trabajo de flotación',
      wednesday,
      MONDAY,
    );
    expect(snap.groupNotes[0].sessionDate).toBe(MONDAY);
    await expect(
      repo.appendGroupNoteConfirmed(
        'mon',
        'Fecha equivocada',
        wednesday,
        WEDNESDAY,
      ),
    ).rejects.toThrow('weekday');
    await expect(
      repo.appendStudentNoteConfirmed(
        'p1',
        'mon',
        'Fecha imposible',
        wednesday,
        '2026-02-31',
      ),
    ).rejects.toThrow();
    expect((await repo.snapshot()).groupNotes).toHaveLength(1);
  });

  it('records left and joined events on transfer without touching old notes', async () => {
    const {repo} = await course();
    await repo.appendGroupNoteConfirmed('mon', 'Nota grupal', monday, MONDAY);
    const before = await repo.appendStudentNoteConfirmed(
      'p1',
      'mon',
      'Nota alumno',
      monday,
      MONDAY,
    );
    const after = await repo.transferConfirmed(
      'p1',
      'wed',
      wednesday,
      'Cambio autorizado demo',
    );
    expect(after.groupNotes).toEqual(before.groupNotes);
    expect(after.studentNotes).toEqual(before.studentNotes);
    expect(after.groupEvents.map(e => [e.groupId, e.kind])).toEqual([
      ['mon', 'left'],
      ['wed', 'joined'],
    ]);
    expect(after.groupEvents[0].transferId).toBe(after.transfers[0].id);
  });

  it('flags notes for review and resolves them as appended events', async () => {
    const {repo} = await course();
    const withNote = await repo.appendGroupNoteConfirmed(
      'mon',
      'Interesante',
      monday,
      MONDAY,
    );
    const noteId = withNote.groupNotes[0].id;
    await repo.flagForReviewConfirmed(noteId, monday, 'Repasar flotación');
    const flagged = pendingReviews(await repo.snapshot());
    expect(flagged.map(item => item.note.id)).toEqual([noteId]);
    expect(flagged[0].reason).toBe('Repasar flotación');
    await expect(repo.flagForReviewConfirmed(noteId, monday)).rejects.toThrow(
      'already',
    );
    await repo.resolveReviewConfirmed(noteId, wednesday);
    const after = await repo.snapshot();
    expect(pendingReviews(after)).toEqual([]);
    expect(after.reviewEvents).toHaveLength(2);
    await expect(
      repo.resolveReviewConfirmed(noteId, wednesday),
    ).rejects.toThrow('not pending');
    await expect(
      repo.flagForReviewConfirmed('missing', monday),
    ).rejects.toThrow('Unknown note');
  });

  it('answers history queries: the student keeps theirs, the group keeps its own', async () => {
    const {repo} = await course();
    await repo.appendGroupNoteConfirmed('mon', 'Nota grupal', monday, MONDAY);
    await repo.appendStudentNoteConfirmed('p1', 'mon', 'Antes', monday, MONDAY);
    await repo.transferConfirmed(
      'p1',
      'wed',
      wednesday,
      'Cambio autorizado demo',
    );
    await repo.appendStudentNoteConfirmed(
      'p1',
      'wed',
      'Después',
      wednesday,
      WEDNESDAY,
    );
    const snap = await repo.snapshot();
    const student = studentHistory(snap, 'p1');
    expect(student.notes.map(n => [n.groupId, n.text])).toEqual([
      ['mon', 'Antes'],
      ['wed', 'Después'],
    ]);
    expect(student.transfers).toHaveLength(1);
    const origin = groupHistory(snap, 'mon');
    expect(origin.groupNotes.map(n => n.text)).toEqual(['Nota grupal']);
    expect(origin.events.map(e => e.kind)).toEqual(['left']);
    expect(groupHistory(snap, 'wed').events.map(e => e.kind)).toEqual([
      'joined',
    ]);
    expect(() => studentHistory(snap, 'nope')).toThrow('Unknown participant');
  });

  it('searches across groups and flags several matches instead of merging them', async () => {
    const {repo} = await course();
    const snap = await repo.snapshot();
    const both = findAcrossGroups(snap, 'PERSONA');
    expect(both.ambiguous).toBe(true);
    expect(both.matches.map(m => m.groupId)).toEqual(['mon', 'wed']);
    const one = findAcrossGroups(snap, 'otra');
    expect(one.ambiguous).toBe(false);
    expect(one.matches[0].participantId).toBe('p2');
    expect(findAcrossGroups(snap, '  ').matches).toEqual([]);
  });
});
