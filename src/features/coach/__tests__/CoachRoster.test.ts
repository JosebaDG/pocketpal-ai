import {CoachRosterSession, parseCoachRoster} from '../CoachRoster';

const fixture = JSON.stringify({schemaVersion: 1, groups: [
  {id: 'swim-a', title: 'Demo natación', sport: 'swimming', weekday: 'lunes', startTime: '17:00'},
  {id: 'tennis-b', title: 'Demo tenis', sport: 'tennis', weekday: 'martes', startTime: '18:00'},
], participants: [
  {id: 'person-1', groupId: 'swim-a', displayName: 'Lía Ejemplo', status: 'enrolled'},
  {id: 'person-2', groupId: 'swim-a', displayName: 'Teo Ejemplo', status: 'waiting'},
  {id: 'person-3', groupId: 'tennis-b', displayName: 'Lía Prueba', status: 'enrolled'},
]});

describe('Coach roster: synthetic data only', () => {
  it('scopes search to selected group and excludes waiting list', () => {
    const session = new CoachRosterSession(parseCoachRoster(fixture));
    expect(() => session.findParticipants('Lia')).toThrow('Choose a group first');
    session.selectGroup('swim-a');
    expect(session.findParticipants('Lia').map(item => item.id)).toEqual(['person-1']);
    expect(session.findParticipants('Teo')).toEqual([]);
  });
  it('does not attribute notes across groups or to waiting list', () => {
    const session = new CoachRosterSession(parseCoachRoster(fixture));
    session.selectGroup('swim-a');
    expect(() => session.draftObservation('person-3', 'Agarra el borde')).toThrow();
    expect(() => session.draftObservation('person-2', 'Agarra el borde')).toThrow();
    expect(session.draftObservation('person-1', 'Agarra el borde').saved).toBe(false);
  });
  it('rejects contacts and duplicate identifiers on import', () => {
    expect(() => parseCoachRoster(fixture.replace('Lía Ejemplo', 'Lía Ejemplo\",\"email\":\"example@example.com'))).toThrow();
    const data = JSON.parse(fixture);
    data.participants[1].id = data.participants[0].id;
    expect(() => parseCoachRoster(JSON.stringify(data))).toThrow('Invalid or repeated participant');
  });
});
