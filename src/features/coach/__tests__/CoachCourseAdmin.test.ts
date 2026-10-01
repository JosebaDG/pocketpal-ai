import type {Database} from '@nozbe/watermelondb';

import {CoachCourseRepository} from '../CoachCourseRepository';
import {parseCoachRoster} from '../CoachRoster';
import {
  RESET_ALL_PHRASE,
  WatermelonCoachCourseAdmin,
} from '../WatermelonCoachCourseAdmin';
import {WatermelonCoachCourseStorage} from '../WatermelonCoachCourseStorage';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {where: (column: string, value: string) => ({column, value})},
}));

const roster = () =>
  parseCoachRoster(
    JSON.stringify({
      schemaVersion: 1,
      groups: [
        {
          id: 'a',
          title: 'Demo',
          sport: 'swimming',
          weekday: 'lunes',
          startTime: '17:00',
        },
      ],
      participants: [
        {id: 'p1', groupId: 'a', displayName: 'Persona Demo', status: 'enrolled'},
      ],
    }),
  );

function fakeDatabase() {
  type Fields = {
    workspaceId: string;
    courseId: string;
    snapshotJson: string;
    revision: number;
    createdAt: number;
    updatedAt: number;
  };
  type Operation = {commit: () => void};
  const rows: ReturnType<typeof makeRow>[] = [];
  let tail: Promise<void> = Promise.resolve();
  function serial<T>(task: () => Promise<T>) {
    const result = tail.then(task);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  function makeRow() {
    const row = {
      workspaceId: '',
      courseId: '',
      snapshotJson: '',
      revision: 0,
      createdAt: 0,
      updatedAt: 0,
      prepareUpdate: (mutate: (value: Fields) => void): Operation => {
        const next = {...row};
        mutate(next);
        return {
          commit: () => {
            Object.assign(row, next);
          },
        };
      },
      prepareDestroyPermanently: (): Operation => ({
        commit: () => {
          const index = rows.indexOf(row);
          if (index >= 0) {
            rows.splice(index, 1);
          }
        },
      }),
    };
    return row;
  }
  const batch = jest.fn(async (...operations: Operation[]) => {
    operations.forEach(operation => operation.commit());
  });
  const collection = {
    query: (...clauses: {column: string; value: string}[]) => ({
      fetch: async () =>
        rows.filter(row =>
          clauses.every(
            clause =>
              (clause.column === 'workspace_id' ? row.workspaceId : row.courseId) ===
              clause.value,
          ),
        ),
    }),
    prepareCreate: (mutate: (value: Fields) => void): Operation => {
      const row = makeRow();
      mutate(row);
      return {
        commit: () => {
          rows.push(row);
        },
      };
    },
  };
  const db = {
    get: () => collection,
    read: serial,
    write: serial,
    batch,
  } as unknown as Database;
  return {db, rows, batch};
}

const scopes = [
  {workspaceId: 'ws1', courseId: 'c1'},
  {workspaceId: 'ws1', courseId: 'c2'},
  {workspaceId: 'ws2', courseId: 'c1'},
];

async function seeded() {
  const fake = fakeDatabase();
  const storage = new WatermelonCoachCourseStorage(fake.db);
  for (const scope of scopes) {
    await new CoachCourseRepository(scope, storage).createConfirmed(roster());
  }
  return {...fake, storage, admin: new WatermelonCoachCourseAdmin(fake.db)};
}

// Synthetic database only: proves the rules, not native SQLite behaviour.
describe('confirmed course deletion and reset', () => {
  it('lists the courses of one workspace without mixing others', async () => {
    const {admin} = await seeded();
    expect((await admin.listCourses('ws1')).map(c => c.courseId)).toEqual([
      'c1',
      'c2',
    ]);
    expect((await admin.listCourses('ws2')).map(c => c.courseId)).toEqual([
      'c1',
    ]);
    expect(await admin.listCourses('ws3')).toEqual([]);
  });

  it('rejects invalid identifiers', async () => {
    const {admin} = await seeded();
    await expect(admin.listCourses('bad id!')).rejects.toThrow('Invalid');
  });

  it('needs the typed name and removes nothing without it', async () => {
    const {admin, rows} = await seeded();
    await expect(
      admin.deleteCourseConfirmed('ws1', 'c1', 'c2'),
    ).rejects.toThrow('Typed confirmation');
    expect(rows).toHaveLength(3);
  });

  it('deletes only that course and allows importing it again', async () => {
    const {admin, rows, storage} = await seeded();
    await admin.deleteCourseConfirmed('ws1', 'c1', 'c1');
    expect(rows.map(r => `${r.workspaceId}/${r.courseId}`).sort()).toEqual([
      'ws1/c2',
      'ws2/c1',
    ]);
    const gone = new CoachCourseRepository(scopes[0], storage);
    await expect(gone.snapshot()).rejects.toThrow('Course not imported');
    await gone.createConfirmed(roster());
    expect(rows).toHaveLength(3);
  });

  it('reports a course that does not exist', async () => {
    const {admin} = await seeded();
    await expect(
      admin.deleteCourseConfirmed('ws1', 'zzz', 'zzz'),
    ).rejects.toThrow('Course not found');
  });

  it('resets one workspace and leaves the others untouched', async () => {
    const {admin, rows} = await seeded();
    await expect(admin.resetWorkspaceConfirmed('ws1', 'ws2')).rejects.toThrow(
      'Typed confirmation',
    );
    expect(rows).toHaveLength(3);
    expect(await admin.resetWorkspaceConfirmed('ws1', 'ws1')).toBe(2);
    expect(rows.map(r => r.workspaceId)).toEqual(['ws2']);
  });

  it('removes everything only with the exact phrase', async () => {
    const {admin, rows} = await seeded();
    await expect(admin.deleteAllConfirmed('borrar todo')).rejects.toThrow(
      'Typed confirmation',
    );
    expect(rows).toHaveLength(3);
    expect(await admin.deleteAllConfirmed(RESET_ALL_PHRASE)).toBe(3);
    expect(rows).toHaveLength(0);
  });

  it('keeps every course when the write fails', async () => {
    const {admin, rows, batch} = await seeded();
    batch.mockRejectedValueOnce(new Error('Disk full'));
    await expect(admin.resetWorkspaceConfirmed('ws1', 'ws1')).rejects.toThrow(
      'Disk full',
    );
    expect(rows).toHaveLength(3);
  });
});
