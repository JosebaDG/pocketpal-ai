export type CoachGroup = {
  id: string;
  title: string;
  sport: string;
  weekday: string;
  startTime: string;
};
export type CoachParticipant = {
  id: string;
  groupId: string;
  displayName: string;
  status: 'enrolled' | 'waiting';
};
export type CoachRoster = {
  schemaVersion: 1;
  groups: CoachGroup[];
  participants: CoachParticipant[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown, max = 120): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const id = (value: unknown): value is string =>
  str(value, 64) && /^[a-zA-Z0-9_-]+$/.test(value);
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every(key => allowed.includes(key));
const normalise = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Strict, minimal import format: no contacts, birthdates or health fields. Never put operational JSON in Git. */
export function parseCoachRoster(json: string): CoachRoster {
  if (json.length > 1_000_000) throw new Error('Roster exceeds size limit');
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (
    !record(data) ||
    !keys(data, ['schemaVersion', 'groups', 'participants']) ||
    data.schemaVersion !== 1 ||
    !Array.isArray(data.groups) ||
    !Array.isArray(data.participants) ||
    data.groups.length > 100 ||
    data.participants.length > 10_000
  ) {
    throw new Error('Invalid roster structure');
  }
  const groups: CoachGroup[] = [];
  const groupIds = new Set<string>();
  for (const raw of data.groups) {
    if (
      !record(raw) ||
      !keys(raw, ['id', 'title', 'sport', 'weekday', 'startTime']) ||
      !id(raw.id) ||
      !str(raw.title) ||
      !str(raw.sport, 60) ||
      !str(raw.weekday, 20) ||
      !str(raw.startTime, 5) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.startTime) ||
      groupIds.has(raw.id)
    ) {
      throw new Error('Invalid or repeated group');
    }
    groupIds.add(raw.id);
    groups.push({
      id: raw.id,
      title: raw.title,
      sport: raw.sport,
      weekday: raw.weekday,
      startTime: raw.startTime,
    });
  }
  const participants: CoachParticipant[] = [];
  const participantIds = new Set<string>();
  for (const raw of data.participants) {
    if (
      !record(raw) ||
      !keys(raw, ['id', 'groupId', 'displayName', 'status']) ||
      !id(raw.id) ||
      !id(raw.groupId) ||
      !groupIds.has(raw.groupId) ||
      !str(raw.displayName) ||
      !['enrolled', 'waiting'].includes(String(raw.status)) ||
      participantIds.has(raw.id)
    ) {
      throw new Error('Invalid or repeated participant');
    }
    participantIds.add(raw.id);
    participants.push({
      id: raw.id,
      groupId: raw.groupId,
      displayName: raw.displayName,
      status: raw.status as CoachParticipant['status'],
    });
  }
  return {schemaVersion: 1, groups, participants};
}

const requireGroup = (roster: CoachRoster, groupId: string): CoachGroup => {
  const group = roster.groups.find(item => item.id === groupId);
  if (!group) throw new Error('Unknown group');
  return group;
};

/** Stateless: the caller names the group on every call, so no chat can inherit another chat's selection. */
export function findEnrolledParticipants(
  roster: CoachRoster,
  groupId: string,
  query: string,
): CoachParticipant[] {
  requireGroup(roster, groupId);
  const needle = normalise(query);
  if (!needle) return [];
  return roster.participants.filter(
    item =>
      item.groupId === groupId &&
      item.status === 'enrolled' &&
      normalise(item.displayName).includes(needle),
  );
}

export function draftObservationFor(
  roster: CoachRoster,
  groupId: string,
  participantId: string,
  observed: string,
) {
  requireGroup(roster, groupId);
  const participant = roster.participants.find(
    item =>
      item.id === participantId &&
      item.groupId === groupId &&
      item.status === 'enrolled',
  );
  if (!participant)
    throw new Error('Participant not enrolled in selected group');
  if (!str(observed, 2000)) throw new Error('Invalid observation');
  return {
    groupId,
    participantId,
    observed: observed.trim(),
    saved: false as const,
  };
}

/** Convenience wrapper for callers that do want a session-scoped selection (not used by the Talent). */
export class CoachRosterSession {
  private selectedGroupId: string | null = null;
  constructor(private readonly roster: CoachRoster) {}
  listGroups(): CoachGroup[] {
    return [...this.roster.groups];
  }
  selectGroup(groupId: string): CoachGroup {
    const group = requireGroup(this.roster, groupId);
    this.selectedGroupId = group.id;
    return group;
  }
  findParticipants(query: string): CoachParticipant[] {
    if (!this.selectedGroupId) throw new Error('Choose a group first');
    return findEnrolledParticipants(this.roster, this.selectedGroupId, query);
  }
  draftObservation(participantId: string, observed: string) {
    if (!this.selectedGroupId) throw new Error('Choose a group first');
    return draftObservationFor(
      this.roster,
      this.selectedGroupId,
      participantId,
      observed,
    );
  }
}
