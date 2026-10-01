import {
  SwimGroupsEngine,
  SwimNoteDraftEngine,
  demoSwimAccess,
} from '../SwimAgentEngine';

describe('Swim Agent talents (synthetic data only)', () => {
  const groups = new SwimGroupsEngine(demoSwimAccess);
  const notes = new SwimNoteDraftEngine(demoSwimAccess);

  it('lists groups without contacts', async () => {
    const result = await groups.execute({});
    expect(result.type).toBe('text');
    expect(result.summary).toContain('demo-a');
    expect(result.summary).not.toContain('email');
  });

  it('limits student search to the chosen group', async () => {
    const result = await groups.execute({
      groupId: 'demo-a',
      studentName: 'lia',
    });
    expect(result.type).toBe('text');
    expect(result.summary).toContain('demo-1');
    expect(result.summary).not.toContain('demo-2');
  });

  it('rejects observations attributed to the wrong group', async () => {
    const result = await notes.execute({
      groupId: 'other',
      studentId: 'demo-1',
      date: '2026-09-29',
      observed: 'Agarró el borde',
    });
    expect(result.type).toBe('error');
  });

  it('returns a draft, never a saved note', async () => {
    const result = await notes.execute({
      groupId: 'demo-a',
      studentId: 'demo-1',
      date: '2026-09-29',
      observed: 'Agarró el borde',
      discsLeft: 2,
      discsRight: 2,
    });
    expect(result.type).toBe('text');
    expect(result.summary).toContain('DRAFT_NOT_SAVED');
  });

  it('rejects invalid disc counts', async () => {
    const result = await notes.execute({
      groupId: 'demo-a',
      studentId: 'demo-1',
      date: '2026-09-29',
      observed: 'Agarró el borde',
      discsLeft: 4,
    });
    expect(result.type).toBe('error');
  });
});
