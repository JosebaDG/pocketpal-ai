import {
  CoachRosterSession,
  draftObservationFor,
  findEnrolledParticipants,
  parseCoachRoster,
} from '../CoachRoster';

const roster = parseCoachRoster(
  JSON.stringify({
    schemaVersion: 1,
    groups: [
      {
        id: 'a',
        title: 'Demo A',
        sport: 'demo',
        weekday: 'lunes',
        startTime: '17:00',
      },
      {
        id: 'b',
        title: 'Demo B',
        sport: 'demo',
        weekday: 'martes',
        startTime: '17:00',
      },
    ],
    participants: [
      {id: 'p1', groupId: 'a', displayName: 'Izadi Uno', status: 'enrolled'},
      {id: 'p2', groupId: 'b', displayName: 'Izadi Dos', status: 'enrolled'},
      {id: 'p3', groupId: 'a', displayName: 'Izadi Tres', status: 'waiting'},
    ],
  }),
);

describe('stateless roster functions (synthetic data only)', () => {
  it('returns homonyms only from the named group and never waiting-list people', () => {
    expect(
      findEnrolledParticipants(roster, 'a', 'izadi').map(p => p.id),
    ).toEqual(['p1']);
    expect(
      findEnrolledParticipants(roster, 'b', 'izadi').map(p => p.id),
    ).toEqual(['p2']);
  });
  it('rejects unknown groups and cross-group attribution', () => {
    expect(() => findEnrolledParticipants(roster, 'zzz', 'izadi')).toThrow(
      'Unknown group',
    );
    expect(() =>
      draftObservationFor(roster, 'a', 'p2', 'Observación'),
    ).toThrow();
    expect(() =>
      draftObservationFor(roster, 'a', 'p3', 'Observación'),
    ).toThrow();
    expect(draftObservationFor(roster, 'a', 'p1', ' Observación ').saved).toBe(
      false,
    );
  });
  it('keeps the session wrapper consistent with the stateless functions', () => {
    const session = new CoachRosterSession(roster);
    expect(() => session.findParticipants('izadi')).toThrow(
      'Choose a group first',
    );
    session.selectGroup('b');
    expect(session.findParticipants('izadi').map(p => p.id)).toEqual(['p2']);
  });
});
