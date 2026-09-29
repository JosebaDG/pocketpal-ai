import {CoachWorkspaceEngine} from '../CoachWorkspaceEngine';

describe('coach workspace Talent (synthetic only)', () => {
  it('requires a selected group and scopes lookup', async () => {
    const engine = new CoachWorkspaceEngine();
    expect((await engine.execute({action: 'find_participants', query: 'Lia'})).type).toBe('error');
    expect((await engine.execute({action: 'select_group', groupId: 'swim-demo'})).type).toBe('text');
    const found = await engine.execute({action: 'find_participants', query: 'Lia'});
    expect(found.summary).toContain('learner-1');
    expect(found.summary).not.toContain('learner-3');
    expect(found.summary).not.toContain('learner-2');
  });
  it('does not save notes or send messages', async () => {
    const engine = new CoachWorkspaceEngine();
    await engine.execute({action: 'select_group', groupId: 'swim-demo'});
    expect((await engine.execute({action: 'draft_note', participantId: 'learner-1', observed: 'Se agarró al borde'})).summary).toContain('DRAFT_NOT_SAVED');
    expect((await engine.execute({action: 'draft_message', participantId: 'learner-1', message: 'Hola, os contamos lo observado.'})).summary).toContain('DRAFT_NOT_SENT');
    expect((await engine.execute({action: 'draft_message', participantId: 'learner-2', message: 'Hola'})).type).toBe('error');
    expect((await engine.execute({action: 'group_snapshot'})).summary).toContain('NO_HISTORY_AVAILABLE');
  });
});
