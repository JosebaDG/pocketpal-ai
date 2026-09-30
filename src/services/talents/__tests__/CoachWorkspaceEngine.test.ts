import {CoachWorkspaceEngine} from '../CoachWorkspaceEngine';
import type {CoachFileAccess} from '../coachFileAccess';

const noFiles: CoachFileAccess = {pickRosterJson: async () => null};

describe('coach workspace Talent (stateless, synthetic only)', () => {
  it('requires groupId on every scoped call and remembers no selection', async () => {
    const engine = new CoachWorkspaceEngine(noFiles);
    expect((await engine.execute({action: 'find_participants', query: 'Lia'})).type).toBe('error');
    expect((await engine.execute({action: 'select_group', groupId: 'swim-demo'})).summary).toContain('"selectionStored":false');
    expect((await engine.execute({action: 'find_participants', query: 'Lia'})).type).toBe('error');
    const found = await engine.execute({action: 'find_participants', groupId: 'swim-demo', query: 'Lia'});
    expect(found.summary).toContain('learner-1');
    expect(found.summary).not.toContain('learner-2');
    expect(found.summary).not.toContain('learner-3');
  });

  it('does not save notes or send messages, and rejects cross-group attribution', async () => {
    const engine = new CoachWorkspaceEngine(noFiles);
    expect((await engine.execute({action: 'draft_note', groupId: 'swim-demo', participantId: 'learner-1', observed: 'Se agarró al borde'})).summary).toContain('DRAFT_NOT_SAVED');
    expect((await engine.execute({action: 'draft_note', groupId: 'swim-demo', participantId: 'learner-3', observed: 'x'})).type).toBe('error');
    expect((await engine.execute({action: 'draft_message', groupId: 'swim-demo', participantId: 'learner-1', message: 'Hola'})).summary).toContain('DRAFT_NOT_SENT');
    expect((await engine.execute({action: 'draft_message', groupId: 'swim-demo', participantId: 'learner-2', message: 'Hola'})).type).toBe('error');
    expect((await engine.execute({action: 'group_snapshot', groupId: 'swim-demo'})).summary).toContain('NO_HISTORY_AVAILABLE');
  });

  it('imports through the injected file access and keeps the previous data when a file is invalid', async () => {
    const valid = JSON.stringify({schemaVersion: 1, groups: [{id: 'g1', title: 'Demo', sport: 'demo', weekday: 'lunes', startTime: '10:00'}], participants: [{id: 'x1', groupId: 'g1', displayName: 'Persona Demo', status: 'enrolled'}]});
    let next: string | null = valid;
    const engine = new CoachWorkspaceEngine({pickRosterJson: async () => next});
    expect((await engine.execute({action: 'import_roster'})).summary).toContain('IMPORTED_IN_MEMORY_NOT_PERSISTED');
    expect((await engine.execute({action: 'list_groups'})).summary).toContain('g1');
    next = 'not json';
    expect((await engine.execute({action: 'import_roster'})).type).toBe('error');
    expect((await engine.execute({action: 'list_groups'})).summary).toContain('g1');
    next = null;
    expect((await engine.execute({action: 'import_roster'})).type).toBe('error');
  });
});
