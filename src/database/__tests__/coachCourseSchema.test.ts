import schema from '../schema';
import migrations from '../migrations';
import {coachCourseDefinition} from '../coachCourseDefinition';

it('adds only coach_courses in migration 9 and preserves existing tables', () => {
  const declared = schema as unknown as {version: number; tables: {name: string; columns: unknown[]}[]};
  const history = migrations as unknown as {migrations: {toVersion: number; steps: {type: string; schema: unknown}[]}[]};
  expect(declared.version).toBe(9);
  expect(history.migrations.map(item => item.toVersion)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  const table = declared.tables.find(item => item.name === 'coach_courses');
  expect(table).toEqual(coachCourseDefinition);
  expect(declared.tables.map(item => item.name)).toEqual(expect.arrayContaining(['chat_sessions', 'messages', 'completion_settings', 'global_settings', 'cached_pals', 'user_library', 'sync_status', 'local_pals']));
  const latest = history.migrations.at(-1)!;
  expect(latest.steps).toHaveLength(1);
  expect(latest.steps[0].type).toBe('create_table');
});
