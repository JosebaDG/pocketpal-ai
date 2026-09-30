import type {Database} from '@nozbe/watermelondb';
import {CoachCourseRepository} from '../CoachCourseRepository';
import {WatermelonCoachCourseStorage} from '../WatermelonCoachCourseStorage';
import {parseCoachRoster} from '../CoachRoster';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {where: (column: string, value: string) => ({column, value})},
}));

const scope = {workspaceId: 'demo', courseId: 'course'};
const at = '2026-09-30T10:00:00Z';
const fixture = () => parseCoachRoster(JSON.stringify({schemaVersion: 1, groups: [
  {id: 'a', title: 'Demo', sport: 'swimming', weekday: 'lunes', startTime: '17:00'},
], participants: [{id: 'p1', groupId: 'a', displayName: 'Persona Demo', status: 'enrolled'}]}));

function fakeDatabase() {
  type Fields = {workspaceId: string; courseId: string; snapshotJson: string; revision: number; createdAt: number; updatedAt: number};
  type Operation = {commit: () => void};
  const rows: ReturnType<typeof makeRecord>[] = [];
  let tail: Promise<void> = Promise.resolve();
  function serial<T>(task: () => Promise<T>) {
    const result = tail.then(task);
    tail = result.then(() => undefined, () => undefined);
    return result;
  }
  function makeRecord() {
    const row = {
      workspaceId: '', courseId: '', snapshotJson: '', revision: 0, createdAt: 0, updatedAt: 0,
      prepareUpdate: (mutate: (value: Fields) => void): Operation => {
        const next = {...row};
        mutate(next);
        return {commit: () => {Object.assign(row, next);}};
      },
    };
    return row;
  }
  const batch = jest.fn(async (...operations: Operation[]) => {operations.forEach(op => op.commit());});
  const collection = {
    query: (...clauses: {column: string; value: string}[]) => ({fetch: async () => rows.filter(row => clauses.every(c => (c.column === 'workspace_id' ? row.workspaceId : row.courseId) === c.value))}),
    prepareCreate: (mutate: (value: Fields) => void): Operation => {
      const row = makeRecord();
      mutate(row);
      return {commit: () => {rows.push(row);}};
    },
  };
  const db = {get: () => collection, read: serial, write: serial, batch} as unknown as Database;
  return {db, rows, batch};
}

describe('Watermelon storage contract with synthetic database', () => {
  it('recovers notes with a new adapter and isolates spaces', async () => {
    const {db} = fakeDatabase();
    const first = new CoachCourseRepository(scope, new WatermelonCoachCourseStorage(db));
    await first.createConfirmed(fixture());
    await first.appendStudentNoteConfirmed('p1', 'a', 'Nota demo', at);
    const reopened = new CoachCourseRepository(scope, new WatermelonCoachCourseStorage(db));
    expect((await reopened.snapshot()).studentNotes[0].text).toBe('Nota demo');
    const other = new CoachCourseRepository({...scope, workspaceId: 'other'}, new WatermelonCoachCourseStorage(db));
    await other.createConfirmed(fixture());
    expect((await other.snapshot()).studentNotes).toEqual([]);
  });

  it('rejects stale revisions from two adapters without overwriting the first write', async () => {
    const {db} = fakeDatabase();
    const one = new WatermelonCoachCourseStorage(db);
    const two = new WatermelonCoachCourseStorage(db);
    const repo = new CoachCourseRepository(scope, one);
    const base = await repo.createConfirmed(fixture());
    const candidate = JSON.stringify({...base, revision: 1});
    const results = await Promise.allSettled([one.write(scope, candidate), two.write(scope, candidate)]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect((await repo.snapshot()).revision).toBe(1);
  });

  it('rejects duplicate creation and propagates batch failures', async () => {
    const {db, rows, batch} = fakeDatabase();
    const storage = new WatermelonCoachCourseStorage(db);
    const repo = new CoachCourseRepository(scope, storage);
    const base = await repo.createConfirmed(fixture());
    await expect(storage.write(scope, JSON.stringify(base))).rejects.toThrow('revision conflict');
    batch.mockRejectedValueOnce(new Error('Disk full'));
    await expect(repo.appendGroupNoteConfirmed('a', 'No guardada', at)).rejects.toThrow('Disk full');
    expect(rows).toHaveLength(1);
    expect((await repo.snapshot()).groupNotes).toEqual([]);
  });

  it('rejects corrupt metadata and duplicate records without resetting them', async () => {
    const {db, rows} = fakeDatabase();
    const storage = new WatermelonCoachCourseStorage(db);
    await new CoachCourseRepository(scope, storage).createConfirmed(fixture());
    rows[0].revision = 99;
    await expect(storage.read(scope)).rejects.toThrow('metadata mismatch');
    rows[0].revision = 0;
    rows.push(rows[0]);
    await expect(storage.read(scope)).rejects.toThrow('Duplicate course records');
    expect(rows).toHaveLength(2);
  });
});
