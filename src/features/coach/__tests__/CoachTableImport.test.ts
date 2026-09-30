import {CoachTableImportSession, prepareTableImport} from '../CoachTableImport';
import type {ImportTable, TableSelection} from '../CoachTableImport';
import {CoachCourseRepository} from '../CoachCourseRepository';

const groups = ['a', 'b'].map(id => ({id, title: `Demo ${id}`, sport: 'swimming', weekday: 'lunes', startTime: '17:00'}));
const table = (format: 'docx' | 'xlsx' = 'xlsx'): ImportTable => ({
  id: 'table-1', title: 'Demo', format, sourceFirstRow: 0, sourceFirstColumn: 0,
  rows: [['Nombre', 'Código', 'Contacto'], ['Persona Demo', 'p1', 'private@example.test']].map(row => row.map(text => ({text, kind: 'text'}))),
});
const selection: TableSelection = {tableId: 'table-1', fromRow: 1, toRow: 1, idColumn: 1, nameColumn: 0, groupId: 'a', status: 'enrolled'};

describe('reviewed table imports with synthetic data only', () => {
  it.each(['docx', 'xlsx'] as const)('maps %s tables and drops contact columns', format => {
    const preview = prepareTableImport([table(format)], groups, [selection]);
    expect(preview.issues).toEqual([]);
    expect(preview.roster?.participants[0].id).toBe('p1');
    expect(JSON.stringify(preview)).not.toContain('private@example.test');
  });

  it('preserves waiting status and rejects the same person in two groups', () => {
    const source = table();
    source.rows.push(source.rows[1]);
    const preview = prepareTableImport([source], groups, [selection, {...selection, fromRow: 2, toRow: 2, groupId: 'b', status: 'waiting'}]);
    expect(preview.roster).toBeNull();
    expect(preview.issues[0].code).toBe('MULTIPLE_ACTIVE_GROUPS');
    expect(prepareTableImport([table()], groups, [{...selection, status: 'waiting'}]).roster?.participants[0].status).toBe('waiting');
  });

  it('rejects formulas and numeric identifiers without silently converting them', () => {
    for (const kind of ['formula', 'number'] as const) {
      const source = table();
      source.rows[1][1] = {text: '00123', kind};
      expect(prepareTableImport([source], groups, [selection]).roster).toBeNull();
    }
  });

  it('rejects overlaps and partial rows, but does not merge homonyms', () => {
    expect(prepareTableImport([table()], groups, [selection, selection]).issues[0].code).toBe('OVERLAPPING_SELECTION');
    const source = table();
    source.rows[1][1].text = '';
    expect(prepareTableImport([source], groups, [selection]).roster).toBeNull();
    source.rows[1][1].text = 'p1';
    source.rows.push(source.rows[1].map(cell => ({...cell})));
    source.rows[2][1].text = 'p2';
    expect(prepareTableImport([source], groups, [{...selection, toRow: 2}]).roster?.participants).toHaveLength(2);
  });

  it('writes only on trusted confirmation and binds it to the prepared snapshot', async () => {
    let stored: string | null = null;
    const write = jest.fn(async (_scope, value: string) => {stored = value;});
    const repository = new CoachCourseRepository({workspaceId: 'demo', courseId: 'demo'}, {read: async () => stored, write});
    const session = new CoachTableImportSession(repository);
    const preview = session.prepare([table()], groups, [selection]);
    expect(write).not.toHaveBeenCalled();
    preview.roster!.participants[0].displayName = 'Changed after preview';
    await session.confirmReviewed();
    expect((await repository.snapshot()).roster.participants[0].displayName).toBe('Persona Demo');
    await expect(session.confirmReviewed()).rejects.toThrow();
  });

  it('cannot save a cancelled or invalid preparation', async () => {
    const write = jest.fn();
    const repository = new CoachCourseRepository({workspaceId: 'demo', courseId: 'demo'}, {read: async () => null, write});
    const session = new CoachTableImportSession(repository);
    session.prepare([table()], groups, [selection]);
    session.cancel();
    await expect(session.confirmReviewed()).rejects.toThrow();
    session.prepare([table()], groups, [selection, selection]);
    await expect(session.confirmReviewed()).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });
});
