import type {TalentEngine, TalentResult, ToolDefinition} from './types';
import {CoachRoster, draftObservationFor, findEnrolledParticipants, parseCoachRoster} from '../../features/coach/CoachRoster';
import {CoachFileAccess, defaultCoachFileAccess} from './coachFileAccess';

// Synthetic demonstration data only.
const demo: CoachRoster = parseCoachRoster(JSON.stringify({schemaVersion: 1, groups: [
  {id: 'swim-demo', title: 'Natación — grupo ficticio', sport: 'swimming', weekday: 'martes', startTime: '16:00'},
  {id: 'tennis-demo', title: 'Tenis — grupo ficticio', sport: 'tennis', weekday: 'jueves', startTime: '17:00'},
], participants: [
  {id: 'learner-1', groupId: 'swim-demo', displayName: 'Lía Ejemplo', status: 'enrolled'},
  {id: 'learner-2', groupId: 'swim-demo', displayName: 'Teo Ejemplo', status: 'waiting'},
  {id: 'learner-3', groupId: 'tennis-demo', displayName: 'Noa Ejemplo', status: 'enrolled'},
]}));

const response = (data: unknown): TalentResult => ({type: 'text', summary: JSON.stringify(data)});
const fail = (message: string): TalentResult => ({type: 'error', summary: message, errorMessage: message});
const required = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${name}`);
  return value;
};

/**
 * Stateless coaching workspace: the group is named in EVERY scoped call, so a new chat or Pal can
 * never inherit a previous selection. The only state is the imported dataset (memory only).
 * It never saves notes and never sends messages.
 */
export class CoachWorkspaceEngine implements TalentEngine {
  readonly name = 'coach_workspace';
  private roster: CoachRoster;

  constructor(private readonly files: CoachFileAccess = defaultCoachFileAccess, initial: CoachRoster = demo) {
    this.roster = initial;
  }

  private group(groupId: unknown) {
    const id = required(groupId, 'groupId');
    const group = this.roster.groups.find(item => item.id === id);
    if (!group) throw new Error('Unknown group');
    return group;
  }

  private counts(groupId: string) {
    const members = this.roster.participants.filter(p => p.groupId === groupId);
    return {enrolled: members.filter(p => p.status === 'enrolled').length, waiting: members.filter(p => p.status === 'waiting').length};
  }

  async execute(args: Record<string, any>): Promise<TalentResult> {
    try {
      switch (args.action) {
        case 'import_roster': {
          const raw = await this.files.pickRosterJson();
          if (raw === null) return fail('File selection cancelled');
          const candidate = parseCoachRoster(raw);
          this.roster = candidate;
          return response({status: 'IMPORTED_IN_MEMORY_NOT_PERSISTED', groups: candidate.groups.length, participants: candidate.participants.length});
        }
        case 'list_groups':
          return response({groups: this.roster.groups});
        case 'select_group': {
          const group = this.group(args.groupId);
          return response({group, ...this.counts(group.id), selectionStored: false, note: 'Pass groupId in every later call'});
        }
        case 'find_participants': {
          const group = this.group(args.groupId);
          const matches = findEnrolledParticipants(this.roster, group.id, required(args.query, 'query'));
          return response({groupId: group.id, matches, ambiguous: matches.length > 1});
        }
        case 'draft_note': {
          const group = this.group(args.groupId);
          const draft = draftObservationFor(this.roster, group.id, required(args.participantId, 'participantId'), required(args.observed, 'observed'));
          return response({kind: 'observation', ...draft, status: 'DRAFT_NOT_SAVED'});
        }
        case 'group_snapshot': {
          const group = this.group(args.groupId);
          return response({groupId: group.id, ...this.counts(group.id), assessment: 'NO_HISTORY_AVAILABLE'});
        }
        case 'draft_message': {
          const group = this.group(args.groupId);
          const person = this.roster.participants.find(p => p.id === args.participantId && p.groupId === group.id && p.status === 'enrolled');
          if (!person) throw new Error('Participant not enrolled in selected group');
          const body = required(args.message, 'message').trim();
          if (body.length > 2000) throw new Error('Message too long');
          return response({kind: 'message', participantId: person.id, groupId: group.id, body, recipient: 'NOT_VERIFIED', status: 'DRAFT_NOT_SENT'});
        }
        default:
          return fail('Unknown coach action');
      }
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Action failed');
    }
  }

  toToolDefinition(): ToolDefinition {
    return {type: 'function', function: {
      name: this.name,
      description: 'Local coaching beta. groupId is REQUIRED on every action except list_groups and import_roster; no selection is remembered between calls. Drafts only: never saves or sends.',
      parameters: {type: 'object', properties: {
        action: {type: 'string', enum: ['import_roster', 'list_groups', 'select_group', 'find_participants', 'draft_note', 'group_snapshot', 'draft_message']},
        groupId: {type: 'string'}, query: {type: 'string'}, participantId: {type: 'string'},
        observed: {type: 'string'}, message: {type: 'string'},
      }, required: ['action']},
    }} as ToolDefinition;
  }
}
