import {CoachCourseRepository} from '../CoachCourseRepository';
import type {CoachCourseStorage} from '../CoachCourseRepository';
import {parseCoachRoster} from '../CoachRoster';

const scope = {workspaceId: 'demo-coach', courseId: 'demo-course'};
const at = '2026-09-30T10:00:00Z';
const roster = () =>
  parseCoachRoster(
    JSON.stringify({
      schemaVersion: 1,
      groups: ['a', 'b'].map(id => ({
        id,
        title: `Demo ${id}`,
        sport: 'swimming',
        weekday: 'lunes',
        startTime: '17:00',
      })),
      participants: [
        {id: 'p1', groupId: 'a', displayName: 'Persona Demo', status: 'enrolled'},
        {id: 'p2', groupId: 'a', displayName: 'Espera Demo', status: 'waiting'},
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

// Synthetic storage contract tests, NOT proof of physical-device persistence.
 describe('scoped course repository', () => {
  it('loads the same course and notes through a new repository instance', async () => {
    const {storage} = memoryStorage();
    const first = new CoachCourseRepository(scope, storage);
    await first.createConfirmed(roster());
    await first.appendStudentNoteConfirmed('p1', 'a', 'Observación demo', at);
    const reopened = new CoachCourseRepository(scope, storage);
    expect((await reopened.snapshot()).studentNotes[0].text).toBe('Observación demo');
  });

  it('keeps student history and leaves group history unchanged on transfer', async () => {
    const {storage} = memoryStorage();
    const repo = new CoachCourseRepository(scope, storage);
    await repo.createConfirmed(roster());
    await repo.appendStudentNoteConfirmed('p1', 'a', 'Nota individual', at);
    const before = await repo.appendGroupNoteConfirmed('a', 'Nota grupal', at);
    const after = await repo.transferConfirmed('p1', 'b', at, 'Cambio autorizado demo');
    expect(after.studentNotes).toEqual(before.studentNotes);
    expect(after.groupNotes).toEqual(before.groupNotes);
    expect(after.roster.participants.filter(p => p.id === 'p1')).toHaveLength(1);
    expect(after.roster.participants[0].groupId).toBe('b');
    expect(after.transfers[0]).toMatchObject({fromGroupId: 'a', toGroupId: 'b', at, justification: 'Cambio autorizado demo'});
    await expect(repo.appendStudentNoteConfirmed('p1', 'a', 'Incorrecta', at)).rejects.toThrow();
    await repo.appendStudentNoteConfirmed('p1', 'b', 'Nueva nota', at);
    expect((await repo.snapshot()).studentNotes).toHaveLength(2);
  });

  it('isolates courses/workspaces and refuses silent replacement', async () => {
    const {storage} = memoryStorage();
    const first = new CoachCourseRepository(scope, storage);
    const second = new CoachCourseRepository({...scope, workspaceId: 'other'}, storage);
    const third = new CoachCourseRepository({...scope, courseId: 'other'}, storage);
    await first.createConfirmed(roster());
    await second.createConfirmed(roster());
    await third.createConfirmed(roster());
    await first.appendGroupNoteConfirmed('a', 'Solo primer curso', at);
    expect((await second.snapshot()).groupNotes).toEqual([]);
    expect((await third.snapshot()).groupNotes).toEqual([]);
    await expect(first.createConfirmed(roster())).rejects.toThrow('Course already exists');
  });

  it('does not mutate stored data on validation or write failure', async () => {
    const {storage} = memoryStorage();
    const repo = new CoachCourseRepository(scope, storage);
    const before = await repo.createConfirmed(roster());
    await expect(repo.transferConfirmed('p1', 'b', at, ' ')).rejects.toThrow();
    await expect(repo.appendStudentNoteConfirmed('p2', 'a', 'No inscrito', at)).rejects.toThrow();
    (storage.write as jest.Mock).mockRejectedValueOnce(new Error('Disk unavailable'));
    await expect(repo.appendGroupNoteConfirmed('a', 'No guardada', at)).rejects.toThrow('Disk unavailable');
    expect(await repo.snapshot()).toEqual(before);
    await repo.appendGroupNoteConfirmed('a', 'Reintento', at);
    expect((await repo.snapshot()).groupNotes).toHaveLength(1);
  });

  it('serializes writes in one instance without losing notes', async () => {
    const {storage} = memoryStorage();
    const repo = new CoachCourseRepository(scope, storage);
    await repo.createConfirmed(roster());
    await Promise.all(Array.from({length: 10}, (_, i) => repo.appendGroupNoteConfirmed('a', `Nota ${i}`, at)));
    const data = await repo.snapshot();
    expect(data.groupNotes).toHaveLength(10);
    expect(new Set(data.groupNotes.map(note => note.id)).size).toBe(10);
  });

  it('rejects corrupt or cross-scope snapshots rather than resetting data', async () => {
    const {storage, values, key} = memoryStorage();
    const repo = new CoachCourseRepository(scope, storage);
    values.set(key(scope), 'invalid json');
    await expect(repo.snapshot()).rejects.toThrow();
    expect(values.get(key(scope))).toBe('invalid json');
    values.delete(key(scope));
    const data = await repo.createConfirmed(roster());
    values.set(key(scope), JSON.stringify({...data, workspaceId: 'other'}));
    await expect(repo.snapshot()).rejects.toThrow('Course scope mismatch');
  });
});
