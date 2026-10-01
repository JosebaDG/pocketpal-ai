import {z} from 'zod';

import {parseCoachRoster} from './CoachRoster';
import type {CoachGroup, CoachRoster, CoachParticipant} from './CoachRoster';
import type {CoachCourseRepository} from './CoachCourseRepository';

const cellSchema = z
  .object({
    text: z.string().max(2000),
    kind: z.enum(['text', 'number', 'formula', 'unsupported']),
  })
  .strict();
const tableSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    title: z.string().max(200),
    format: z.enum(['docx', 'xlsx']),
    sourceFirstRow: z.number().int().nonnegative(),
    sourceFirstColumn: z.number().int().nonnegative(),
    rows: z.array(z.array(cellSchema).max(100)).max(10000),
  })
  .strict();
const selectionSchema = z
  .object({
    tableId: z.string(),
    fromRow: z.number().int().nonnegative(),
    toRow: z.number().int().nonnegative(),
    idColumn: z.number().int().nonnegative().max(99),
    nameColumn: z.number().int().nonnegative().max(99),
    groupId: z.string(),
    status: z.enum(['enrolled', 'waiting']),
  })
  .strict();

export type ImportCell = z.infer<typeof cellSchema>;
export type ImportTable = z.infer<typeof tableSchema>;
export type TableSelection = z.infer<typeof selectionSchema>;
export type ImportIssue = {tableId: string; rowNumber: number; code: string};
export type ImportPreview = {
  roster: CoachRoster | null;
  issues: ImportIssue[];
  counts: {groups: number; enrolled: number; waiting: number};
};

/** Pure planner: maps only explicitly selected ranges/columns; never writes. */
export function prepareTableImport(
  input: ImportTable[],
  groups: CoachGroup[],
  choices: TableSelection[],
): ImportPreview {
  const tables = z.array(tableSchema).min(1).max(20).parse(input);
  const selections = z.array(selectionSchema).min(1).max(100).parse(choices);
  const base = parseCoachRoster(
    JSON.stringify({schemaVersion: 1, groups, participants: []}),
  );
  if (new Set(tables.map(table => table.id)).size !== tables.length) {
    throw new Error('Repeated source table ID');
  }
  const issues: ImportIssue[] = [];
  const participants: CoachParticipant[] = [];
  const seenRows = new Set<string>();
  const seenPeople = new Map<string, string>();
  const issue = (tableId: string, rowNumber: number, code: string) => {
    issues.push({tableId, rowNumber, code});
  };
  for (const selection of selections) {
    const table = tables.find(item => item.id === selection.tableId);
    if (
      !table ||
      selection.fromRow > selection.toRow ||
      selection.toRow >= table.rows.length ||
      selection.idColumn === selection.nameColumn ||
      !base.groups.some(group => group.id === selection.groupId)
    ) {
      throw new Error('Invalid table mapping');
    }
    for (let index = selection.fromRow; index <= selection.toRow; index += 1) {
      const rowNumber = table.sourceFirstRow + index + 1;
      const rowKey = `${table.id}:${index}`;
      if (seenRows.has(rowKey)) {
        issue(table.id, rowNumber, 'OVERLAPPING_SELECTION');
        continue;
      }
      seenRows.add(rowKey);
      const row = table.rows[index];
      const code = row[selection.idColumn];
      const name = row[selection.nameColumn];
      if (code?.kind === 'formula' || name?.kind === 'formula') {
        issue(table.id, rowNumber, 'FORMULA_IN_REQUIRED_FIELD');
        continue;
      }
      if (!code?.text.trim() && !name?.text.trim()) {
        continue;
      }
      if (code?.kind !== 'text' || name?.kind !== 'text') {
        issue(table.id, rowNumber, 'TEXT_FIELDS_REQUIRED');
        continue;
      }
      const id = code.text.trim();
      const displayName = name.text.trim();
      if (
        !/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
        !displayName ||
        displayName.length > 120
      ) {
        issue(table.id, rowNumber, 'INVALID_ID_OR_NAME');
        continue;
      }
      const previousGroup = seenPeople.get(id);
      if (previousGroup !== undefined) {
        issue(
          table.id,
          rowNumber,
          previousGroup === selection.groupId
            ? 'DUPLICATE_PARTICIPANT'
            : 'MULTIPLE_ACTIVE_GROUPS',
        );
        continue;
      }
      seenPeople.set(id, selection.groupId);
      participants.push({
        id,
        displayName,
        groupId: selection.groupId,
        status: selection.status,
      });
      if (participants.length > 10000) {
        throw new Error('Import contains too many participants');
      }
    }
  }
  if (participants.length === 0) {
    issue('import', 0, 'EMPTY_IMPORT');
  }
  let roster: CoachRoster | null = null;
  if (issues.length === 0) {
    roster = parseCoachRoster(JSON.stringify({...base, participants}));
  }
  return {
    roster,
    issues,
    counts: {
      groups: base.groups.length,
      enrolled: participants.filter(p => p.status === 'enrolled').length,
      waiting: participants.filter(p => p.status === 'waiting').length,
    },
  };
}

/** Trusted UI controller. No model-facing save action or confirmation boolean. */
export class CoachTableImportSession {
  private candidate: string | null = null;
  private busy = false;

  constructor(private readonly repository: CoachCourseRepository) {}

  prepare(
    tables: ImportTable[],
    groups: CoachGroup[],
    selections: TableSelection[],
  ) {
    if (this.busy) {
      throw new Error('Import write in progress');
    }
    this.candidate = null;
    const preview = prepareTableImport(tables, groups, selections);
    this.candidate = preview.roster ? JSON.stringify(preview.roster) : null;
    return preview;
  }

  cancel() {
    if (this.busy) {
      throw new Error('Import write in progress');
    }
    this.candidate = null;
  }

  /** Invoke only from the explicit review/confirm UI, not from a Talent. */
  async confirmReviewed() {
    if (this.busy || this.candidate === null) {
      throw new Error('No valid pending import');
    }
    const roster = parseCoachRoster(this.candidate);
    this.busy = true;
    try {
      const result = await this.repository.createConfirmed(roster);
      this.candidate = null;
      return result;
    } finally {
      this.busy = false;
    }
  }
}
