import {
  lastSessionDate,
  normaliseNoteText,
  noteDraftId,
} from '../CoachNoteDraft';

const draft = {
  kind: 'student' as const,
  groupId: 'g1',
  participantId: 'p1',
  sessionDate: '2026-10-19',
  text: 'Respira bien por la izquierda',
};

describe('note draft id', () => {
  it('is stable and fits the repository identifier rule', () => {
    const id = noteDraftId(draft);
    expect(id).toBe(noteDraftId({...draft}));
    expect(id).toMatch(/^draft-[0-9a-f]{28}$/);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it('ignores spacing and Unicode composition, not content', () => {
    const composed = noteDraftId({...draft, text: 'Mejoró mucho'});
    const decomposed = noteDraftId({
      ...draft,
      text: '  Mejoro\u0301   mucho ',
    });
    expect(decomposed).toBe(composed);
    expect(noteDraftId({...draft, text: 'Mejoró poco'})).not.toBe(composed);
  });

  it('changes with student, group, day or kind', () => {
    const base = noteDraftId(draft);
    expect(noteDraftId({...draft, participantId: 'p2'})).not.toBe(base);
    expect(noteDraftId({...draft, groupId: 'g2'})).not.toBe(base);
    expect(noteDraftId({...draft, sessionDate: '2026-10-12'})).not.toBe(base);
    expect(
      noteDraftId({
        kind: 'group',
        groupId: draft.groupId,
        sessionDate: draft.sessionDate,
        text: draft.text,
      }),
    ).not.toBe(base);
  });

  it('normalises text the same way for comparison', () => {
    expect(normaliseNoteText(' a \n b ')).toBe('a b');
  });
});

describe('last session date', () => {
  // 2026-10-21 is a Wednesday.
  it('returns today when the group meets today', () => {
    expect(lastSessionDate('miércoles', '2026-10-21')).toBe('2026-10-21');
  });

  it('goes back to the last class day', () => {
    expect(lastSessionDate('lunes', '2026-10-21')).toBe('2026-10-19');
    expect(lastSessionDate('jueves', '2026-10-21')).toBe('2026-10-15');
  });

  it('keeps today for an unknown weekday', () => {
    expect(lastSessionDate('cada día', '2026-10-21')).toBe('2026-10-21');
  });
});
